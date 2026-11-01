import { app, BrowserWindow, nativeTheme } from "electron"
import path from "path"

// Windows only shows notifications for apps with an AppUserModelID (matches electron-builder's appId).
if (process.platform === "win32") app.setAppUserModelId("com.kaizen.tracker")

app.on("ready", () => {
  // Determine the theme and set appropriate colors
  const isDarkMode = nativeTheme.shouldUseDarkColors

  const windowConfig = {
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    // Match app theme colors in navbar
    backgroundColor: isDarkMode ? "#251F1A" : "#EDE8E3", // Dark or light theme background
  }

  const win = new BrowserWindow(windowConfig)

  // Apply theme to window
  if (process.platform === "darwin") {
    win.setVibrancy("fullscreen-ui")
  }

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173")
  } else {
    win.loadFile(path.join(app.getAppPath(), "dist-react", "index.html"))
  }
})

// Listen for system theme changes
nativeTheme.on("updated", () => {
  const allWindows = BrowserWindow.getAllWindows()
  allWindows.forEach((win) => {
    const isDarkMode = nativeTheme.shouldUseDarkColors
    win.setBackgroundColor(isDarkMode ? "#251F1A" : "#EDE8E3")
  })
})

app.setLoginItemSettings({
  openAtLogin: true,
})
