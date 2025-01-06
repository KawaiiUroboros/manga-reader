document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(data => {
        document.getElementById('status').textContent = data;
    })
    .catch(error => {
        document.getElementById('status').textContent = 'An error occurred: ' + error;
    });
});