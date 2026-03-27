# CodeTrackr for Visual Studio Code

**CodeTrackr** is an open-source VS Code plugin for metrics, insights, and time tracking automatically generated from your programming activity.

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)

## Installation

1. Press `F1` or `⌘ + Shift + P` and type `install`. Pick **Extensions: Install Extension**.
2. Type `codetrackr` and hit enter.
3. Click **Install**.

## Usage

1. Visit [https://codetrackr.leapcell.app](https://codetrackr.leapcell.app) to get your **API Key**.
2. In VS Code, press `F1` or `⌘ + Shift + P` and type `CodeTrackr: Enter API Key`.
3. Paste your key and press `Enter`.
4. Use VS Code and your coding activity will be displayed on your **CodeTrackr dashboard**.

## Configuring

VS Code specific settings are available from `⌘ + Shift + P`, then typing `codetrackr`.

### Status Bar Info
You are able to select what time to show in your status bar:
1. Press `⌘ + Shift + P` then select **CodeTrackr: Status Bar Style**.
2. Supported options are:
    *   `Today`: Show today's total code time. (Default)
    *   `24h`: Show code time in the last 24 hours.
    *   `Total`: Show total code time recorded.
    *   `None`: Disable stats in the status bar.

### Status Bar Alignment
You can customize the position of the CodeTrackr status bar item:
1. Press `⌘ + Shift + P` then select **CodeTrackr: Status Bar Alignment**.
2. Select **Left** or **Right**.

## Troubleshooting

If you encounter issues, check the extension logs:
1. Press `F1` or `⌘ + Shift + P`
2. Type `CodeTrackr: Show Log` and press `Enter`.
3. This will open an Output Channel with detailed activity and error messages.

## Uninstalling

1. Click the **Extensions** sidebar item in VS Code.
2. Type `codetrackr` and hit enter.
3. Click the settings icon next to CodeTrackr, then click **Uninstall**.

## Contributing

Pull requests, bug reports, and feature requests are welcome!

### To run from source:

1. `git clone https://github.com/livrasand/codetrackr-vscode.git`
2. `cd codetrackr-vscode`
3. `pnpm install`
4. `pnpm run watch`
5. Press `F5` in VS Code to launch the extension in debug mode.

---

Made with ❤️ by [Livrädo Sandoval](https://github.com/livrasand) and the CodeTrackr community.
