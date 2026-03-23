const fs = require('fs');

const popupJs = fs.readFileSync('browser-extension/popup.js', 'utf8');

if (popupJs.includes('innerHTML')) {
    console.error('Failure: innerHTML still found in popup.js');
    process.exit(1);
}

if (!popupJs.includes('function setButtonContent(btn, iconName, text, iconOptions = { size: \'inline\' })')) {
    console.error('Failure: setButtonContent helper not found');
    process.exit(1);
}

if (!popupJs.includes('function restoreSyncButton()')) {
    console.error('Failure: restoreSyncButton helper not found');
    process.exit(1);
}

console.log('Success: Extension source code manually verified.');
