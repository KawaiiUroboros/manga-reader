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

// Fetch manga list on page load
fetch('/manga')
    .then(response => response.json())
    .then(mangaList => {
        const mangaListElement = document.getElementById('manga-list');
        mangaList.forEach(manga => {
            const li = document.createElement('li');
            li.textContent = manga;
            li.addEventListener('click', () => {
                currentManga = manga; // Set current manga
                currentPage = 0; // Reset page number
                loadMangaChapters(manga);
            });
            mangaListElement.appendChild(li);
        });
    })
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        const mangaListElement = document.getElementById('manga-list');
        mangaListElement.innerHTML = '<li>Error loading manga list</li>';
    });

function loadMangaChapters(mangaTitle) {
    fetch(`/manga/${mangaTitle}`)
        .then(response => response.json())
        .then(chapters => {
            const chapterListElement = document.getElementById('chapter-list');
            chapterListElement.innerHTML = ''; // Clear previous chapters
            chapters.forEach(chapter => {
                const li = document.createElement('li');
                li.textContent = `Chapter ${chapter}`;
                li.addEventListener('click', () => {
                    currentChapter = chapter; // Set current chapter
                    currentPage = 0;
                    loadMangaPages(mangaTitle, chapter);
                });
                chapterListElement.appendChild(li);
            });
        })
        .catch(error => console.error('Error:', error));
}

function loadMangaPages(mangaTitle, chapterNumber) {
    // Fetch the list of pages for the selected chapter
    fetch(`/manga/${mangaTitle}/${chapterNumber}`)
        .then(response => response.json())
        .then(pages => {
            totalPages = pages.length;
            if (totalPages > 0) {
                loadMangaPage(mangaTitle, chapterNumber, 0); // Load the first page
            }
        })
        .catch(error => console.error('Error:', error));
}

function loadMangaPage(mangaTitle, chapterNumber, pageNumber) {
    fetch(`/manga/${mangaTitle}/${chapterNumber}/${pageNumber}`)
        .then(response => response.blob())
        .then(blob => {
            const imageUrl = URL.createObjectURL(blob);
            const imgElement = document.createElement('img');
            imgElement.src = imageUrl;
            imgElement.alt = `Page ${pageNumber + 1}`;

            const mangaViewer = document.getElementById('manga-viewer');
            mangaViewer.innerHTML = '';
            mangaViewer.appendChild(imgElement);
        })
        .catch(error => console.error('Error:', error));
}

document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 0) {
        currentPage--;
        loadMangaPage(currentManga, currentChapter, currentPage);
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages - 1) {
        currentPage++;
        loadMangaPage(currentManga, currentChapter, currentPage);
    }
});
