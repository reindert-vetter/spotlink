// Saves options to chrome.storage
function save_options() {
    chrome.storage.sync.set({
        activateKey: document.getElementById('activate_key').value
    }, function() {
        // Update status to let user know options were saved.
        let status = document.getElementById('status');
        status.textContent = 'Options saved';
        document.getElementById('save').style.display = 'none';
        setTimeout(function() {
            status.textContent = '';
        }, 2000);
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {

    document.getElementById('key_press').addEventListener('click', function () {
        document.getElementById('status').textContent = 'Now press a key';
    });

    chrome.storage.sync.get({
        activateKey: '17'
    }, function(items) {
        document.getElementById('activate_key').value = items.activateKey;
    });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);

document.onkeydown=function(e) {
    document.getElementById('activate_key').value = e.which;
    document.getElementById('status').textContent = 'Selected key id: ' + e.which;
    document.getElementById('save').style.display = 'block';
};