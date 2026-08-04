<script setup>
import { onBeforeUnmount, ref } from 'vue'

import {
  invokeDemoMessage,
  offDemoMessage,
  onDemoMessage,
  onceDemoMessage,
  requestMainMessages,
  sendDemoMessage,
} from '@/apis/demo'
import { getUserInfo, login, logout } from '@/apis/user'

const isElectron = typeof window !== 'undefined' && Boolean(window.mainApi)
const username = ref('Ada')
const userPending = ref(false)
const userResult = ref(null)
const demoMessage = ref('Hello from Renderer')
const invokeResult = ref(null)
const logs = ref([])
const isListening = ref(false)
const isOncePending = ref(false)

function addLog(source, payload) {
  logs.value.unshift({
    id: `${Date.now()}-${Math.random()}`,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    source,
    time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  })
  logs.value = logs.value.slice(0, 30)
}

async function runUserAction(action) {
  userPending.value = true
  try {
    userResult.value = await action()
  } catch (error) {
    userResult.value = { data: null, message: error.message, ok: false }
  } finally {
    userPending.value = false
  }
}

function handleLogin() {
  runUserAction(() => login({ username: username.value }))
}

function handleGetUserInfo() {
  runUserAction(getUserInfo)
}

function handleLogout() {
  runUserAction(logout)
}

function handleSend() {
  try {
    sendDemoMessage(demoMessage.value)
    addLog('send', demoMessage.value)
  } catch (error) {
    addLog('error', error.message)
  }
}

async function handleInvoke() {
  try {
    invokeResult.value = await invokeDemoMessage(demoMessage.value)
    addLog('invoke', invokeResult.value)
  } catch (error) {
    invokeResult.value = { message: error.message, ok: false }
    addLog('error', error.message)
  }
}

const handleOnMessage = (payload) => addLog('on', payload)
const handleOnceMessage = (payload) => {
  isOncePending.value = false
  addLog('once', payload)
}

function startListening() {
  if (isListening.value) {return}

  try {
    onDemoMessage(handleOnMessage)
    isListening.value = true
    addLog('on', '已订阅 demo:message')
  } catch (error) {
    addLog('error', error.message)
  }
}

function stopListening() {
  if (!isListening.value) {return}

  offDemoMessage(handleOnMessage)
  isListening.value = false
  addLog('off', '已取消 demo:message')
}

function registerOnce() {
  try {
    onceDemoMessage(handleOnceMessage)
    isOncePending.value = true
    addLog('once', '已注册 demo:once-message')
  } catch (error) {
    addLog('error', error.message)
  }
}

function triggerMainMessages() {
  try {
    requestMainMessages()
    addLog('send', '已请求 Main 推送示例消息')
  } catch (error) {
    addLog('error', error.message)
  }
}

onBeforeUnmount(() => {
  if (isListening.value) {
    offDemoMessage(handleOnMessage)
  }
})
</script>

<template>
  <div class="ipc-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Main / Preload / Renderer</p>
        <h2>IPC 操作台</h2>
      </div>
      <span :class="['runtime-status', { available: isElectron }]">
        {{ isElectron ? 'Electron API 可用' : '浏览器预览模式' }}
      </span>
    </div>

    <div class="demo-grid">
      <section class="demo-panel">
        <header class="panel-heading">
          <div>
            <p class="panel-index">01</p>
            <h3>用户 API</h3>
          </div>
          <code>src/apis/user.js</code>
        </header>

        <label class="field-label" for="username">用户名</label>
        <input
          id="username"
          v-model="username"
          :disabled="!isElectron || userPending"
          autocomplete="off"
          placeholder="输入用户名" />

        <div class="button-row">
          <button :disabled="!isElectron || userPending" @click="handleLogin">登录</button>
          <button class="secondary" :disabled="!isElectron || userPending" @click="handleGetUserInfo">
            获取用户
          </button>
          <button class="danger" :disabled="!isElectron || userPending" @click="handleLogout">退出</button>
        </div>

        <pre class="result-output">{{ userResult ?? '等待操作' }}</pre>
      </section>

      <section class="demo-panel">
        <header class="panel-heading">
          <div>
            <p class="panel-index">02</p>
            <h3>send / invoke</h3>
          </div>
          <code>src/apis/demo.js</code>
        </header>

        <label class="field-label" for="demo-message">消息内容</label>
        <input
          id="demo-message"
          v-model="demoMessage"
          :disabled="!isElectron"
          autocomplete="off" />

        <div class="button-row">
          <button :disabled="!isElectron" @click="handleSend">发送 send</button>
          <button class="secondary" :disabled="!isElectron" @click="handleInvoke">调用 invoke</button>
        </div>

        <pre class="result-output">{{ invokeResult ?? '等待 invoke 结果' }}</pre>
      </section>

      <section class="demo-panel event-panel">
        <header class="panel-heading">
          <div>
            <p class="panel-index">03</p>
            <h3>on / once / off</h3>
          </div>
          <span class="listener-state">{{ isListening ? 'on 已订阅' : 'on 未订阅' }}</span>
        </header>

        <div class="button-row">
          <button :disabled="!isElectron || isListening" @click="startListening">订阅 on</button>
          <button class="danger" :disabled="!isElectron || !isListening" @click="stopListening">取消 off</button>
          <button class="secondary" :disabled="!isElectron || isOncePending" @click="registerOnce">
            注册 once
          </button>
          <button class="secondary" :disabled="!isElectron" @click="triggerMainMessages">触发推送</button>
        </div>
      </section>

      <section class="demo-panel log-panel">
        <header class="panel-heading">
          <div>
            <p class="panel-index">04</p>
            <h3>通信日志</h3>
          </div>
          <button class="quiet" :disabled="logs.length === 0" @click="logs = []">清空</button>
        </header>

        <div class="log-list" aria-live="polite">
          <p v-if="logs.length === 0" class="empty-log">暂无日志</p>
          <div v-for="item in logs" :key="item.id" class="log-item">
            <time>{{ item.time }}</time>
            <strong>{{ item.source }}</strong>
            <span>{{ item.payload }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ipc-page {
  display: grid;
  gap: 22px;
}

.page-heading,
.panel-heading,
.button-row,
.log-item {
  display: flex;
  align-items: center;
}

.page-heading,
.panel-heading {
  justify-content: space-between;
  gap: 16px;
}

.eyebrow,
.panel-index {
  margin: 0 0 3px;
  color: var(--color-accent);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

h2,
h3 {
  margin: 0;
  color: var(--color-heading);
  font-weight: 650;
}

h2 {
  font-size: 26px;
}

h3 {
  font-size: 17px;
}

.runtime-status,
.listener-state {
  padding: 5px 9px;
  color: #7a2e0e;
  background: #fffaeb;
  border: 1px solid #fedf89;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 650;
}

.runtime-status.available,
.listener-state {
  color: #065f46;
  background: #ecfdf3;
  border-color: #a6f4c5;
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.demo-panel {
  min-width: 0;
  padding: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.event-panel,
.log-panel {
  grid-column: 1 / -1;
}

.panel-heading {
  min-height: 42px;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

code {
  overflow-wrap: anywhere;
  color: #175cd3;
  font-size: 12px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  color: var(--color-heading);
  font-size: 13px;
  font-weight: 650;
}

input {
  width: 100%;
  height: 40px;
  padding: 0 11px;
  color: var(--color-heading);
  background: var(--color-surface);
  border: 1px solid #98a2b3;
  border-radius: 4px;
  outline: none;
}

input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgb(15 118 110 / 14%);
}

.button-row {
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

button {
  min-height: 36px;
  padding: 7px 12px;
  color: #ffffff;
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  cursor: pointer;
}

button:hover:not(:disabled) {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}

button.secondary,
button.quiet {
  color: #344054;
  background: #ffffff;
  border-color: #98a2b3;
}

button.danger {
  color: var(--color-danger);
  background: #ffffff;
  border-color: #fda29b;
}

button.quiet {
  min-height: 30px;
  padding: 4px 9px;
}

button:disabled,
input:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.result-output {
  min-height: 96px;
  margin: 16px 0 0;
  padding: 12px;
  overflow: auto;
  color: #d1fae5;
  background: #18212f;
  border-radius: 4px;
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
}

.log-list {
  min-height: 116px;
  max-height: 270px;
  overflow: auto;
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.empty-log {
  margin: 0;
  padding: 24px;
  color: var(--color-muted);
  text-align: center;
}

.log-item {
  display: grid;
  grid-template-columns: 72px 60px minmax(0, 1fr);
  gap: 10px;
  min-height: 38px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-border);
}

.log-item:last-child {
  border-bottom: 0;
}

.log-item time,
.log-item strong {
  color: var(--color-muted);
  font-size: 12px;
}

.log-item strong {
  color: var(--color-accent);
}

.log-item span {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-heading);
  font-family: 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
}

@media (max-width: 760px) {
  .demo-grid {
    grid-template-columns: 1fr;
  }

  .event-panel,
  .log-panel {
    grid-column: auto;
  }

  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .log-item {
    grid-template-columns: 64px 48px minmax(0, 1fr);
  }
}
</style>
