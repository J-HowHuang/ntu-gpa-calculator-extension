const OPTIONS = ["overall", "last60", "selection"];

const GRADE_GPA_LOOKUPS = {
    "4.3": {
        "A+": 4.3,
        "A": 4.0,
        "A-": 3.7,
        "B+": 3.3,
        "B": 3.0,
        "B-": 2.7,
        "C+": 2.3,
        "C": 2.0,
        "C-": 1.7,
        "F": 0,
        "(F)": 0,
        "X": 0,
        "(X)": 0
    },
    "4.0": {
        "A+": 4.0,
        "A": 4.0,
        "A-": 3.7,
        "B+": 3.3,
        "B": 3.0,
        "B-": 2.7,
        "C+": 2.3,
        "C": 2.0,
        "C-": 1.7,
        "F": 0,
        "(F)": 0,
        "X": 0,
        "(X)": 0
    }
};

var gpaLookup = GRADE_GPA_LOOKUPS['4.3']


function init() {
    insertCheckboxes();
    updateSelectedCount();
    recalculate().then((values) => insertGpaInfoSection(values));
}

// get course and grade records from HTML
function getRecords(option = "overall") {
    const tables = document.getElementsByClassName("table-responsive");
    var rows = [];
    for (const table of tables) {
        const bodies = table.getElementsByTagName('tbody');
        for (const body of bodies) {
            const row = body.getElementsByTagName('tr');
            rows = rows.concat(Array.prototype.slice.call(row))
        }
    }

    if (option == "selection") {
        rows = rows.filter(row => row.getElementsByClassName('course-selection')[0].checked)
    } else if (option == "last60") {
        rows = rows.sort((a, b) => a.innerText.split('\t')[2].trim() < b.innerText.split('\t')[2].trim() ? 1 : -1);
        var cumCredits = 0;
        var last60rows = [];
        var prevRowSem = "";
        for (const row of rows) {
            const entries = row.innerText.split('\t');
            if (entries[entries.length - 2].trim() in gpaLookup) {
                cumCredits += Number(entries[entries.length - 3].trim());
            }
            // keep adding the whole semester even if credits > 60
            if (cumCredits > 60 && entries[2].trim() != prevRowSem) {
                break;
            }
            last60rows.push(row)
            prevRowSem = entries[2].trim();
        }
        rows = last60rows;
    }

    const records = rows.map(row => {
        const entries = row.innerText.split('\t')
        return {
            "id": entries[4].trim().replace(" ", ""),
            "semester": entries[2].trim(),
            "course": entries[3].trim(),
            "credit": Number(entries[entries.length - 3].trim()),
            "grade": entries[entries.length - 2].trim()
        }
    });

    return records;
}

function getGrade(option = "overall") {
    var records = getRecords(option);
    records = records.filter(record => record['grade'] in gpaLookup);

    var average = records.reduce((a, b) =>
        a + b['credit'] * gpaLookup[b['grade']], 0) / records.reduce((a, b) => a + b['credit'], 0);
    return average;
}

function syncGrade(option = "overall") {
    var toStorage = {}
    toStorage[option] = getGrade(option);
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(toStorage, resolve(toStorage[option]));
    })
}

function recalculate() {
    return Promise.all([...OPTIONS.map(option => syncGrade(option)), chrome.storage.sync.get("selectedCount")]);
}





function updateSelectedCount() {
    // this is a more readable implementation
    const cnt = getRecords("selection")
        .filter(record => record['grade'] in gpaLookup)
        .reduce((a, b) => a + b[['credit']], 0);
    chrome.storage.sync.set({ 'selectedCount': cnt });
}


function insertCheckboxes() {

    function generateCheckbox(id) {
        var td = document.createElement("td");
        var checkbox = document.createElement("input");

        checkbox.classList.add("checkbox");
        checkbox.classList.add("course-selection");
        checkbox.type = "checkbox";
        checkbox.id = id
        checkbox.checked = true;
        checkbox.onclick = () => {
            syncGrade("selection");
            updateSelectedCount();
        };

        td.appendChild(checkbox);
        td.style = "text-align: center;"
        return td
    }

    const tables = Array.prototype.slice.call(document.getElementsByClassName("table-responsive")).slice(1);
    for (var table of tables) {

        // add additional column in table header
        var th = document.createElement("th");
        th.style = "text-align: center; color: white; background-color:Highlight;"
        th.innerText = "選取";

        const heads = table.getElementsByTagName('thead');
        for (const head of heads) {
            var trs = head.getElementsByTagName('tr');
            for (const tr of trs) {
                var cloneth = th.cloneNode(true);
                tr.insertBefore(cloneth, tr.firstChild);
            }
        }

        // add checkboxes in the additional column
        const bodies = table.getElementsByTagName('tbody');
        for (const body of bodies) {
            var trs = body.getElementsByTagName('tr');
            for (const tr of trs) {
                var id = tr.childNodes[3].innerText.replace(" ", ""); // 課號
                var cloneth = generateCheckbox(id);
                if (!(tr.childNodes[7].innerText.trim() in gpaLookup)) {
                    cloneth.childNodes[0].disabled = true;
                    cloneth.childNodes[0].checked = false;
                } else {
                    // for easier select the checkboxes
                    tr.style = 'cursor: pointer; cursor: hand;';
                    tr.addEventListener('click', e => {
                        e.currentTarget.getElementsByTagName('input')[0].click();
                        var selectAllCheckbox = e.currentTarget.parentNode.parentNode.parentNode.previousSibling.getElementsByTagName('input')[0]; // corresponding select all checkbox
                        var trs = e.currentTarget.parentNode.childNodes
                        var hasSelectedAll = Array.prototype.slice.call(trs).every(tr => 
                            tr.getElementsByTagName('input')[0].checked || !(tr.childNodes[8].innerText.trim() in gpaLookup)); // ignore those disabled checkboxes
                        if (hasSelectedAll) {
                            selectAllCheckbox.checked = true;
                        } else {
                            selectAllCheckbox.checked = false;
                        }
                    });
                }
                tr.insertBefore(cloneth, tr.firstChild);
            }
        }
    }
    // inject custom stylesheet for the hovering effect in selecting courses
    var css = '.table-responsive tbody tr:hover{ background-color: #c3c3c3 }';
    var style = document.createElement('style');

    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    document.getElementsByTagName('head')[0].appendChild(style);

    // add select all utility
    for (var table of tables) {
        var title = table.previousSibling;

        var checkbox = document.createElement("input");
        var label = document.createElement("label");

        checkbox.classList.add("checkbox");
        checkbox.type = "checkbox";
        checkbox.id = id
        checkbox.checked = true;
        checkbox.addEventListener('click', e => {
            var table = e.currentTarget.parentNode.parentNode.nextSibling;
            var trs = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
            var hasSelectedAll = Array.prototype.slice.call(trs).every(tr => 
                tr.getElementsByTagName('input')[0].checked || !(tr.childNodes[8].innerText.trim() in gpaLookup)); // ignore those disabled checkboxes
            if (hasSelectedAll == true) {
                for (const tr of trs) {
                    var checkbox = tr.getElementsByTagName('input')[0];
                    checkbox.click();
                }
            } else {
                for (const tr of trs) {
                    var checkbox = tr.getElementsByTagName('input')[0];
                    if (!checkbox.checked) {
                        checkbox.click();
                    }
                }
            }
        })
        checkbox.style = "display: inline;"

        label.appendChild(checkbox);
        label.style = "margin-right: 10px; margin-left: 5px;";

        title.insertBefore(label, title.firstChild);
    }
}

function insertGpaInfoSection(values) {
    data = {
        "overall": values[0],
        "last60": values[1],
        "selection": values[2],
        "selectedCount": values[3]["selectedCount"]
    };
    var gpaInfoSection = `
    <div id="gpaHeader">
        <h3>GPA</h3>
        <div class="switch-area">
        <label class="slot">
            以 4.0 分制顯示
        </label>
            <input class="checkbox" id="gpaswitch" type="checkbox">
        </div>
    </div>
        <div class="table-responsive">
            <table class="table">
                <thead>
                    <tr>
                        <th style="text-align: center; color: white; background-color:Highlight;">Overall</th>
                        <th style="text-align: center;" id="overall">${data["overall"].toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]}</th>
                        <th style="text-align: center; color: white; background-color:Highlight;">Last 60</th>
                        <th style="text-align: center;" id="last60">${data["last60"].toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]}</th>
                        <th style="text-align: center; color: white; background-color:Highlight;" id="selectedCount">已選取 (共${data["selectedCount"]}學分)</th>
                        <th style="text-align: center;" id="selection">${data["selection"].toString().match(/^-?\d+(?:\.\d{0,2})?/)[0]}</th>
                    </tr>
                </thead>
            </table>
        </div>
    `
    var infoSection = document.getElementsByClassName('jumbotron')[0];
    infoSection.innerHTML += gpaInfoSection;

    var gpaCheckbox = document.getElementById("gpaswitch");
    gpaCheckbox.addEventListener('click', e => {
        gpaLookup = e.currentTarget.checked ?
            GRADE_GPA_LOOKUPS['4.0'] : GRADE_GPA_LOOKUPS['4.3'];
        recalculate();
    });
}

chrome.runtime.onMessage.addListener(
    function (msg, sender, sendResponse) {
        for (const key in msg) {
            if (OPTIONS.includes(key)) {
                document.getElementById(key).innerText = Number(msg[key]).toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];
            } else if (key == "selectedCount") {
                document.getElementById(key).innerText = `已選取 (共${msg[key]}學分)`
            }
        }
        sendResponse({ farewell: "goodbye" });
    }
);

init();