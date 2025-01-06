document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(data => {
        document.getElementById('upload-status').textContent = data;
    })
    .catch(error => {
        document.getElementById('upload-status').textContent = 'An error occurred: ' + error;
    });
});

// Fetch manga list on page load
fetch('/manga')
    .then(response => response.json())
    .then(mangaList => {
        const mangaListElement = document.getElementById('manga-list');
        mangaList.forEach(manga => {
            const li = document.createElement('li');
            li.textContent = manga;
            li.addEventListener('click', () => loadMangaChapters(manga));
            mangaListElement.appendChild(li);
        });
    });

function loadMangaChapters(mangaTitle) {
    // Fetch chapters for the selected manga
    fetch(`/manga/${mangaTitle}`)
        .then(response => response.json())
        .then(chapters => {
            const mangaViewer = document.getElementById('manga-viewer');
            mangaViewer.innerHTML = ''; // Clear previous content

            chapters.forEach(chapter => {
                const chapterDiv = document.createElement('div');
                chapterDiv.textContent = `Chapter ${chapter.Number}`;
                chapterDiv.addEventListener('click', () => loadMangaPage(mangaTitle, chapter.Number, 0));
                mangaViewer.appendChild(chapterDiv);
            });
        });
}

function loadMangaPage(mangaTitle, chapterNumber, pageNumber) {
    // Fetch the image for the requested page
    fetch(`/manga/${mangaTitle}/${chapterNumber}/${pageNumber}`)
        .then(response => response.blob())
        .then(imageBlob => {
            const mangaViewer = document.getElementById('manga-viewer');
            mangaViewer.innerHTML = ''; // Clear previous content

            const img = document.createElement('img');
            img.src = URL.createObjectURL(imageBlob);
            mangaViewer.appendChild(img);

            // Add navigation buttons
            const prevButton = document.createElement('button');
            prevButton.textContent = 'Previous';
            prevButton.addEventListener('click', () => loadMangaPage(mangaTitle, chapterNumber, pageNumber - 1));
            mangaViewer.appendChild(prevButton);

            const nextButton = document.createElement('button');
            nextButton.textContent = 'Next';
            nextButton.addEventListener('click', () => loadMangaPage(mangaTitle, chapterNumber, pageNumber + 1));
            mangaViewer.appendChild(nextButton);
        });
}

// Add event listeners to buttons
document.getElementById('view-button').addEventListener('click', () => {
    document.getElementById('manga-viewer').style.display = 'block';
    document.getElementById('manga-controls').style.display = 'block';
    document.getElementById('upload-form').style.display = 'none';
});

document.getElementById('upload-button').addEventListener('click', () => {
    document.getElementById('manga-viewer').style.display = 'none';
    document.getElementById('manga-controls').style.display = 'none';
    document.getElementById('upload-form').style.display = 'block';
});
