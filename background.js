// background.js

// listen to the change of averages (overall, last 60, last 90, custom) and fire it to popup.js
chrome.storage.onChanged.addListener(async function (changes, namespace) {
    var msg = {};
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        msg[key] = newValue
    }
    chrome.runtime.sendMessage(msg, (res)=>console.log(res));

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, msg, (res)=>console.log(res));
});
