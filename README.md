<p align="center">
  <img src="public\Preview Image.png" alt="Preview Image" width="100%">
</

REhash is a lightning-fast, local Video Hash Modifier. It modifies the hash of video files by appending a null byte to the end of the file, allowing you to quickly change a file's hash without needing to re-encode the entire video.

## Features

- Blazing fast processing: Modifies the hash instantly.
- No re-encoding: Appends a null byte, preserving the original video quality and format.
- 100% Local: Files never leave your device. All processing is done locally.
- Drag & Drop interface: Simple and intuitive user experience.
- Supports multiple formats: .mp4, .avi, .mkv, .mov, .webm, and more.

## Installation & Build

Ensure you have Node.js and Rust installed on your system.

1. Clone the repository
2. Install Node dependencies: `npm install`
3. Run in development mode: `npm run tauri dev`
4. Build the executable: `npm run tauri build`

The built executable will be located in `src-tauri/target/release/`.

### Note for Windows Users
Because this is a free and open-source tool, the executable is not signed with a paid Code Signing Certificate. When you run the `.exe` for the first time, Windows Defender SmartScreen may show a blue warning screen saying "Windows protected your PC". 

This is entirely normal for unsigned open-source applications. To run the app, simply click **"More info"** and then **"Run anyway"**.

## Open Source & Contribution

This is an open source project. You are completely free to fork this repository, modify it, and use it as you see fit. 

If you find this project helpful or plan to build upon it, please remember to acknowledge and credit "Ivan Nguyen" for the original work and contributions. Pull requests and improvements are always welcome.

## License

MIT License
