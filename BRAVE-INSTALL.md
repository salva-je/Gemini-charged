# Brave Browser Installation Guide

## Specific Steps for Brave Browser

### Prerequisites
1. Make sure you have the latest version of Brave Browser
2. Ensure JavaScript is enabled
3. Disable aggressive ad blocking for gemini.google.com

### Installation Steps

1. **Download the Extension**
   - Download or clone this repository to your computer
   - Extract the files to a folder (e.g., `gemini-quick-scroll`)

2. **Open Brave Extensions Page**
   - Open Brave Browser
   - Type `brave://extensions/` in the address bar
   - Press Enter

3. **Enable Developer Mode**
   - Look for the "Developer mode" toggle in the top right corner
   - Click to enable it

4. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to the folder where you extracted the extension files
   - Select the folder and click "Select Folder"

5. **Configure Brave Shields (Important!)**
   - Go to `gemini.google.com`
   - Click on the Brave Shields icon (lion icon) in the address bar
   - Set the following:
     - **Trackers & ads blocking**: Standard (not Aggressive)
     - **Upgrade connections to HTTPS**: OFF for this site
     - **Block scripts**: OFF
     - **Block fingerprinting**: Standard (not Strict)

6. **Verify Installation**
   - Refresh the Gemini page
   - You should see the sidebar appear on the left
   - Open browser console (F12) and look for "GQS: Brave detectado" message

### Troubleshooting for Brave

#### Problem: Extension doesn't load
**Solution:**
- Make sure Developer mode is enabled
- Try reloading the extension: Go to `brave://extensions/`, find the extension, click "Remove", then reinstall

#### Problem: Sidebar doesn't appear
**Solution:**
- Check Brave Shields settings (step 5 above)
- Disable all Brave Shields for gemini.google.com temporarily
- Refresh the page

#### Problem: Extension appears but doesn't work
**Solution:**
- Open browser console (F12)
- Look for any error messages
- Try disabling other extensions temporarily
- Clear browser cache and cookies for gemini.google.com

#### Problem: Storage/notes don't save
**Solution:**
- Go to `brave://settings/content/cookies`
- Make sure "Allow sites to save and read cookie data" is enabled
- Add `gemini.google.com` to the "Sites that can always use cookies" list

### Brave-Specific Features

The extension includes special optimizations for Brave:
- Enhanced timing for storage operations
- Improved script injection reliability
- Better error handling for Brave's security features
- Automatic retries for failed operations

### Alternative Installation (if above doesn't work)

If the standard installation doesn't work, try using the Manifest V2 version:

1. In the extension folder, rename `manifest.json` to `manifest-v3.json`
2. Rename `manifest-v2.json` to `manifest.json`
3. Reload the extension in Brave

### Testing

After installation, you can test the extension by:
1. Going to `gemini.google.com`
2. Opening browser console (F12)
3. Pasting and running the test script from `test-compatibility.js`

### Support

If you're still having issues:
1. Check that Brave is updated to the latest version
2. Try disabling other extensions
3. Test in a new Brave profile
4. Check the browser console for specific error messages

The extension has been specifically optimized for Brave and should work reliably with these settings.
