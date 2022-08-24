const OPTIONS = ["overall", "selection", "last60"];

function updatePopup() {
    chrome.storage.sync.get(OPTIONS, data => {
        for (const option of OPTIONS){
            document.getElementById(option).innerText = data[option].toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]; // fix to the second decimal without rounding
        }
    });
    chrome.storage.sync.get(['selectedCount'], data => {
        document.getElementById('selectedCount').innerText = `(${data['selectedCount']})`;
    })
    // listen to the message from background.js while averages change
    chrome.runtime.onMessage.addListener(
        function (msg, sender, sendResponse) {
            console.log('receive',msg);
            for (const key in msg) {
                if (OPTIONS.includes(key)){
                    document.getElementById(key).innerText = Number(msg[key]).toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];
                } else if (key == "selectedCount") {
                    document.getElementById('selectedCount').innerText = `(${msg[key]})`
                }
            }
            sendResponse({farewell: "goodbye"});
        }
    );
}
document.addEventListener('DOMContentLoaded', updatePopup);