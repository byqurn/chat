// Configuration
let config = {
  channel: "byqurn",
  maxMessages: 10,
  messageFadeTime: 0, // in seconds, 0 = no fade
  backgroundOpacity: 60, // percentage
}

// DOM Elements
const chatContainer = document.getElementById("chat-container")
const connectionStatus = document.getElementById("connection-status")
const settingsToggle = document.getElementById("settings-toggle")
const settingsContent = document.getElementById("settings-content")
const channelInput = document.getElementById("channel-input")
const maxMessagesInput = document.getElementById("max-messages")
const messageFadeInput = document.getElementById("message-fade")
const bgOpacityInput = document.getElementById("bg-opacity")
const opacityValue = document.getElementById("opacity-value")
const saveSettingsBtn = document.getElementById("save-settings")

// State
const userColors = {}
let ws = null
let reconnectAttempts = 0
let reconnectTimeout = null

// Load saved settings
function loadSettings() {
  const savedSettings = localStorage.getItem("kickChatSettings")
  if (savedSettings) {
    try {
      config = { ...config, ...JSON.parse(savedSettings) }

      // Update UI with saved settings
      channelInput.value = config.channel
      maxMessagesInput.value = config.maxMessages
      messageFadeInput.value = config.messageFadeTime
      bgOpacityInput.value = config.backgroundOpacity
      opacityValue.textContent = `${config.backgroundOpacity}%`

      // Apply background opacity
      updateBackgroundOpacity(config.backgroundOpacity)
    } catch (e) {
      console.error("Failed to load settings:", e)
    }
  }
}

// Save settings
function saveSettings() {
  config.channel = channelInput.value.trim()
  config.maxMessages = Number.parseInt(maxMessagesInput.value)
  config.messageFadeTime = Number.parseInt(messageFadeInput.value)
  config.backgroundOpacity = Number.parseInt(bgOpacityInput.value)

  localStorage.setItem("kickChatSettings", JSON.stringify(config))

  // Apply settings
  updateBackgroundOpacity(config.backgroundOpacity)

  // Reconnect to new channel if changed
  connectWebSocket()

  // Hide settings panel
  settingsContent.classList.add("hidden")
}

// Update background opacity
function updateBackgroundOpacity(opacity) {
  const chatMessages = document.querySelectorAll(".chat-message")
  chatMessages.forEach((msg) => {
    msg.style.background = `rgba(0, 0, 0, ${opacity / 100})`
  })
}

// Generate random color for usernames
function getRandomColor() {
  const colors = [
    "#ff5e5e",
    "#ffd15e",
    "#5eff8a",
    "#5ecbff",
    "#b75eff",
    "#ff5ecd",
    "#ff9c5e",
    "#5effdb",
    "#d1ff5e",
    "#5e7bff",
    "#ff5e7b",
    "#c4ff5e",
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

// Parse emojis in text
function parseEmojis(text) {
  // Basic emoji parsing - this could be enhanced with a proper emoji library
  return text.replace(/:[a-zA-Z0-9_]+:/g, (match) => {
    const emojiName = match.slice(1, -1)
    return `<span class="emoji">😊</span>`
  })
}

// Add message to chat
function addMessage(username, message, badges = []) {
  if (!userColors[username]) {
    userColors[username] = getRandomColor()
  }

  const div = document.createElement("div")
  div.className = "chat-message"
  div.style.background = `rgba(0, 0, 0, ${config.backgroundOpacity / 100})`

  // Create badges HTML
  let badgesHtml = ""
  if (badges.includes("moderator")) {
    badgesHtml += '<span class="badge badge-mod">MOD</span>'
  }
  if (badges.includes("subscriber")) {
    badgesHtml += '<span class="badge badge-sub">SUB</span>'
  }
  if (badges.includes("vip")) {
    badgesHtml += '<span class="badge badge-vip">VIP</span>'
  }

  div.innerHTML = `${badgesHtml}<span class="username" style="color: ${userColors[username]}">${escapeHtml(username)}:</span> ${parseEmojis(escapeHtml(message))}`

  chatContainer.appendChild(div)

  // Remove old messages
  while (chatContainer.children.length > config.maxMessages) {
    chatContainer.removeChild(chatContainer.firstChild)
  }

  // Set up message fade if enabled
  if (config.messageFadeTime > 0) {
    setTimeout(() => {
      div.classList.add("fading")
      setTimeout(() => {
        if (div.parentNode === chatContainer) {
          chatContainer.removeChild(div)
        }
      }, 500)
    }, config.messageFadeTime * 1000)
  }
}

// Connect to WebSocket
function connectWebSocket() {
  // Close existing connection if any
  if (ws) {
    ws.close()
  }

  connectionStatus.textContent = "Connecting..."
  connectionStatus.className = "status-indicator"

  try {
    ws = new WebSocket(`wss://chat.kick.com/chat/${config.channel}`)

    ws.addEventListener("open", () => {
      connectionStatus.textContent = "Connected"
      connectionStatus.className = "status-indicator connected"
      reconnectAttempts = 0

      // Hide status after 3 seconds
      setTimeout(() => {
        connectionStatus.style.opacity = "0"
      }, 3000)
    })

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.event === "chatMessage") {
          const username = data.sender.username
          const message = data.content
          const badges = []

          // Extract badges
          if (data.sender.is_moderator) badges.push("moderator")
          if (data.sender.is_subscriber) badges.push("subscriber")
          if (data.sender.is_vip) badges.push("vip")

          addMessage(username, message, badges)
        }
      } catch (e) {
        console.error("Failed to parse message:", e)
      }
    })

    ws.addEventListener("close", () => {
      handleDisconnect()
    })

    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error)
      handleDisconnect()
    })
  } catch (error) {
    console.error("Failed to connect:", error)
    handleDisconnect()
  }
}

// Handle disconnection and reconnect
function handleDisconnect() {
  connectionStatus.textContent = `Disconnected. Reconnecting... (${reconnectAttempts + 1})`
  connectionStatus.className = "status-indicator error"
  connectionStatus.style.opacity = "0.7"

  // Clear any existing reconnect timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
  }

  // Exponential backoff for reconnect
  const delay = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttempts))
  reconnectAttempts++

  reconnectTimeout = setTimeout(() => {
    connectWebSocket()
  }, delay)
}

// Event Listeners
settingsToggle.addEventListener("click", () => {
  settingsContent.classList.toggle("hidden")
})

saveSettingsBtn.addEventListener("click", saveSettings)

bgOpacityInput.addEventListener("input", () => {
  opacityValue.textContent = `${bgOpacityInput.value}%`
})

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadSettings()
  connectWebSocket()

  // Add test message for preview
  setTimeout(() => {
    addMessage("KickChat", "Welcome to the Kick Chat Overlay! 👋", ["moderator"])
  }, 1000)
})

// Handle visibility change to reconnect when tab becomes visible again
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && (!ws || ws.readyState !== WebSocket.OPEN)) {
    connectWebSocket()
  }
})
