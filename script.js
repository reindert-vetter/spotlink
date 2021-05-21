const maxResult = 5;
const maxLatestUsedShortcuts = 2000;
const searchSelector = 'a,tr,button,.btn';

let shortcuts = [];
let lastKey;
let activateKey = '';
let resultItems = [];

function isElementVisible(el) {
    var rect     = el.getBoundingClientRect(),
        vWidth   = window.innerWidth || doc.documentElement.clientWidth,
        vHeight  = window.innerHeight || doc.documentElement.clientHeight,
        efp      = function (x, y) { return document.elementFromPoint(x, y) };

    // Return false if it's not in the viewport
    if (rect.right < 0 || rect.bottom < 0
        || rect.left > vWidth || rect.top > vHeight)
        return false;

    // Return true if any of its four corners are visible
    return (
        el.contains(efp(rect.left,  rect.top))
        ||  el.contains(efp(rect.right, rect.top))
        ||  el.contains(efp(rect.right, rect.bottom))
        ||  el.contains(efp(rect.left,  rect.bottom))
    );
}

// If not in iframe
if (window.self === window.top) {
    setInterval(function () {
        chrome.storage.sync.get({
            eventShowSearchBar: false
        }, settings => {
            if (settings.eventShowSearchBar === true) {
                chrome.storage.sync.set({
                    eventShowSearchBar: false
                });
                slInit();
            }
        });
    }, 300);

    /**
     * If Google, set tabindex
     */
    function r(f){/in/.test(document.readyState)?setTimeout('r('+f+')',9):f()}
    r(function(){
        if (window.location.pathname === "/search") {

            /**
             * Search bar set tabIndex
             */
            document.getElementById('lst-ib').tabIndex = 998;

            /**
             * Focus first element
             */
            let googleResultItems = document.getElementById('center_col').querySelectorAll('.r a');
            if (isElementVisible(googleResultItems[0])) {
                googleResultItems[0].focus();
            }

            /**
             * Set tabIndex to results
             */
            for (let i = 0; i < googleResultItems.length; i++) {
                let googleResultItem = googleResultItems[i];
                googleResultItem.tabIndex = 999;
            }
        }
    });
}

document.onmousedown = function (e) {
    cancelSearchBar();
};


document.onkeydown=function(e){
    chrome.storage.sync.get({
        activateKey: '91'
    }, items => {
        activateKey = parseInt(items.activateKey);
    });

    let currentKey = e.which;

    /* if event is esc */
    if (currentKey === 27) {
        cancelSearchBar();
        lastKey = currentKey;
        return;
    }

    /* nav results */
    if (typeof document.querySelector('input[name="sl_choice"]:checked') !== 'undefined' &&
        currentKey === 40 ||
        currentKey === 38
    ) {
        let currentSelectedItem = document.querySelector('input[name="sl_choice"]:checked').parentElement;

        /* up */
        if (currentKey === 40 && null !== currentSelectedItem.nextSibling) {
            let radioUp = currentSelectedItem.nextSibling.querySelector('input[name="sl_choice"]');
            radioUp.checked = true;
        }

        /* down */
        if (currentKey === 38 && null !== currentSelectedItem.previousSibling) {
            let radioDown = currentSelectedItem.previousSibling.querySelector('input[name="sl_choice"]');
            radioDown.checked = true;
        }

        lastKey = currentKey;
        return;
    }

    const cmdKey = 91

    // Only trigger popup if last key is shift
    if (lastKey !== cmdKey || currentKey !== activateKey) {
        lastKey = currentKey;
        return;
    }

    slInit();
};

function slInit() {
    /**
     * If in iframe
     */
    if (window.self !== window.top) {
        chrome.storage.sync.set({
            eventShowSearchBar: true
        });
    }
    /**
     * If outside iframe and tab is active
     */
    else if (!document.hidden) {

        chrome.storage.sync.get(settings => {
            let latestUsedShortcuts = settings["latestUsedShortcuts"] ? settings["latestUsedShortcuts"] : [];
            console.info('Latest used');
            console.info(latestUsedShortcuts.length);
            console.info(latestUsedShortcuts);
            showSearchBar();
            setShortcuts(latestUsedShortcuts);
            fillResultBar();
        });
    }
}

function showSearchBar() {
    cancelSearchBar();
    let e = document.createElement('form');
    e.id = 'sl_wrapper';
    e.innerHTML =
        '<div id="sl_search"><input id="sl_search_input" placeholder="Spotlink Search" autocomplete="off" /></div>' +
        '<ul class="sl_grid" id="sl_result" ></ul>';


    document.getElementsByTagName('body')[0].appendChild(e);
    e.addEventListener('submit', function(event){event.preventDefault();doSearch()});

    let input = document.getElementById("sl_search_input");
    input.oninput = fillResultBar;
    setTimeout(function(){
        input.focus();
    }, 300);
}

function uniq(a) {
    return Array.from(new Set(a));
}

function setShortcuts(latestUsed) {
    shortcuts = [];

    let anchorElements;
    anchorElements = document.querySelectorAll(searchSelector);
    anchorElements = getElementsFromFrame(anchorElements);

    anchorElements = uniq(anchorElements);

    // remove if title is an integer
    for(let i = anchorElements.length - 1; i >= 0; i--) {
        let title = getTitleFromElement(anchorElements[i]);
        if(isInteger(title)) {
            anchorElements.splice(i, 1);
        }
    }

    let currentPageLatestUsed = getCurrentPageLatestUsed(anchorElements, latestUsed);

    setShortcutsFromElements(currentPageLatestUsed);
    shortcuts['home'] = {'alias': 'home', 'title': 'Home', 'custom_function': () => { window.location = '/'; }};
    setShortcutsFromElements(anchorElements);
}

function setShortcutsFromElements(anchorElements) {
    for (let i = 0; i < anchorElements.length; i++) {
        let anchorElement = anchorElements[i];
        let title = getTitleFromElement(anchorElement);

        if (title.length > 1 &&
            anchorElement.offsetWidth > 0 &&
            !(title in shortcuts)
        ) {
            /* set mapping to call this element later */
            shortcuts[title.toLowerCase()] = {
                'alias': title.toLowerCase(),
                'title': title,
                'element': anchorElement
            };
        }
    }
}

function getCurrentPageLatestUsed(anchorElements, latestUsed) {

    let filteredElements = [];
    let currentPageLatestUsed = [];

    for (let i = 0; i < anchorElements.length; i++) {
        let element = anchorElements[i];
        let alias = getTitleFromElement(element).toLowerCase();

        if (latestUsed.indexOf(alias) !== -1 && typeof filteredElements[alias] === 'undefined') {
            filteredElements[alias] = element;
        }
    }

    for (let i = 0; i < latestUsed.length; i++) {
        let alias = latestUsed[i];
        if (typeof filteredElements[alias] !== 'undefined') {
            currentPageLatestUsed.unshift(filteredElements[alias]);
        }
    }

    return currentPageLatestUsed;
}

function setLatestUsedShortcuts(element) {
    if (element.innerText.length < 1) {
        console.info('element niet toegevoegd:');
        console.info(element);
        return;
    }

    chrome.storage.sync.get(settings => {
        let latestUsedShortcuts = settings["latestUsedShortcuts"] ? settings["latestUsedShortcuts"] : [];
        let newLatestUsedShortcuts = [];

        for (let i = 0; i < latestUsedShortcuts.length; i++) {
            let alias = latestUsedShortcuts[i];
            if (alias !== getTitleFromElement(element).toLowerCase() && mustKeepLatestUsedShortcut(latestUsedShortcuts, i)) {
                newLatestUsedShortcuts.push(alias);
            }
        }
        newLatestUsedShortcuts.push(getTitleFromElement(element).toLowerCase());

        latestUsedShortcuts = newLatestUsedShortcuts;
        chrome.storage.sync.set({latestUsedShortcuts});
    });
}

/**
 *  Remove old records
 **/
function mustKeepLatestUsedShortcut(latestUsedShortcuts, index) {
    return latestUsedShortcuts.length < maxLatestUsedShortcuts || index > 4;
}

function getTitleFromElement(element) {
    if (typeof element.innerText !== 'undefined') {
        return element.innerText.replace(/\n|\r|\'|\"/g, "").trim();
    }
    console.info('undefined:');
    console.info(element);
}

function getElementsFromFrame(anchorElements) {
    let i, frames;
    frames = document.getElementsByTagName("iframe");
    for (i = 0; i < frames.length; ++i)
    {
        try {
            let frameElements = frames[i].contentDocument.querySelectorAll(searchSelector);
            anchorElements = [...anchorElements, ...frameElements];
        } catch (exception){
            console.info('Blocked a frame with origin');
        }
    }

    return anchorElements;
}

function fillResultBar() {
    resultItems = [];
    let i = 0;
    let searchBar = document.getElementById('sl_result');
    let searchVal = document.getElementById('sl_search_input').value;

    searchBar.innerText = '';

    resultItems = getResultItemsFromRegex(resultItems, '^' + searchVal);
    resultItems = getResultItemsFromRegex(resultItems, searchVal.replace(" ", ".*"));
    resultItems = getResultItemsFromRegex(resultItems, searchVal.split('').join('[^\\s]*\\W*'));

    for (let key in resultItems){
        i++;
        if (i > maxResult) {
            break;
        }

        let option = document.createElement("li");

        let checked;
        if (i === 1) {
            checked = 'checked';
        } else {
            checked = '';
        }

        option.innerHTML =
            "<input type='radio' id='sl_choice_" + i + "' name='sl_choice' " + checked + " value='" + resultItems[key].alias + "'>" +
            "<label for='sl_choice_" + i + "'>" + resultItems[key].title + "</label>";
        searchBar.appendChild(option);
    }

    showHelperSelectedAnchor();
}

function showHelperSelectedAnchor() {
    hideHelperSelectedAnchor();

    if (typeof resultItems[0] === 'undefined') {
      return;
    }
    let element = resultItems[0].element;
    if (typeof element !== 'undefined') {
      element.classList.add('helper_selected_anchor');
    }
}

function hideHelperSelectedAnchor() {
    let elementsWithClass = document.getElementsByClassName('helper_selected_anchor');
    for(let i = 0; i < elementsWithClass.length; i++) {
        let element = elementsWithClass[i];
        element.classList.remove('helper_selected_anchor');
    }
}

function getResultItemsFromRegex(resultItems, searchValReg) {
    if (resultItems.length >= maxResult) {
        return resultItems;
    }

    for (let alias in shortcuts){
        if (containsObject(alias, resultItems, 'alias') === false && alias.match(new RegExp(searchValReg, "gi"))) {
            resultItems.push(shortcuts[alias]);
        }
    }

    return resultItems;
}

function cancelSearchBar() {
    let e = document.getElementById('sl_wrapper');
    if (null !== e) {
        e.remove();
    }

    hideHelperSelectedAnchor();
}

function doSearch() {
    let selected = document.querySelector('input[name="sl_choice"]:checked');

    let key;
    for (let item in shortcuts) {
        if (item === selected.value) {
            key = item;
        }
    }

    let targetItem = shortcuts[key];

    setLatestUsedShortcuts(targetItem.element);

    if (typeof targetItem.element !== 'undefined') {
        targetItem.element.click();
    }

    if (typeof targetItem.custom_function !== 'undefined') {
        targetItem.custom_function();
    }

    cancelSearchBar();
}

function containsObject(obj, list, suffix = '') {
    let i;
    for (i in list) {
        if (list.hasOwnProperty(i) && list[i][suffix] === obj) {
            return true;
        }
    }

    return false;
}

function isInteger(n) {
    return n == +n && n == (n|0);
}
