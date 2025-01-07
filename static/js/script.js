let currentManga = null;
let currentChapter = null;
let currentPage = 0;
let totalPages = 0;

// Function to show a specific section and hide others
function showSection(sectionId) {
    const sections = ['initial-content', 'manga-viewer', 'upload-form'];
    sections.forEach(id => {
        const element = document.getElementById(id);
        if (id === sectionId) {
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    });
}

// Show initial content on page load
document.addEventListener('DOMContentLoaded', () => {
    showSection('initial-content');
    fetchAndDisplayMangaList(); // Fetch and display manga list
});

// Fetch and display manga list
function fetchAndDisplayMangaList() {
    fetch('/manga')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(mangaList => {
            const mangaListElement = document.getElementById('manga-list');
            mangaListElement.innerHTML = ''; // Clear existing list

            if (mangaList.length === 0) {
                // If no manga, show initial content
                showSection('initial-content');
            } else {
                // If manga available, list them
                mangaList.forEach(manga => {
                    const li = document.createElement('li');
                    li.textContent = manga;
                    li.addEventListener('click', () => {
                        currentManga = manga;
                        currentPage = 0;
                        loadMangaChapters(manga);
                    });
                    mangaListElement.appendChild(li);
                });
            }
        })
        .catch(error => {
            console.error('There has been a problem with your fetch operation:', error);
            const mangaListElement = document.getElementById('manga-list');
            mangaListElement.innerHTML = '<li>Error loading manga list</li>';
        });
}

// Load manga chapters
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
                    currentChapter = chapter;
                    currentPage = 0;
                    loadMangaPages(mangaTitle, chapter);
                });
                chapterListElement.appendChild(li);
            });
            showSection('manga-viewer'); // Show manga viewer after loading chapters
        })
        .catch(error => console.error('Error:', error));
}

// Load manga pages
function loadMangaPages(mangaTitle, chapterNumber) {
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

// Load a specific manga page
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

// Event listeners for navigation buttons
document.getElementById('view-button').addEventListener('click', () => {
    // Show initial content or manga viewer based on manga availability
    fetch('/manga')
        .then(response => response.json())
        .then(mangaList => {
            if (mangaList.length === 0) {
                showSection('initial-content');
            } else {
                showSection('manga-viewer');
                if (currentManga) {
                    loadMangaChapters(currentManga);
                }
            }
        })
        .catch(error => console.error('Error:', error));
});

document.getElementById('upload-button').addEventListener('click', () => {
    showSection('upload-form');
});

// Previous and next page buttons
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

// Form submission with progress bar update
document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const xhr = new XMLHttpRequest();

    xhr.open('POST', '/upload');

    // Update progress bar
    xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
            const percentage = Math.round((event.loaded / event.total) * 100);
            document.getElementById('upload-progress').value = percentage;
            document.getElementById('upload-percentage').textContent = `${percentage}%`;
        }
    });

    // Handle server response
    xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
            document.getElementById('upload-status').textContent = xhr.responseText;
            fetchAndDisplayMangaList(); // Refresh manga list
        } else {
            document.getElementById('upload-status').textContent = 'An error occurred: ' + xhr.statusText;
        }
    });

    // Handle error
    xhr.addEventListener('error', () => {
        document.getElementById('upload-status').textContent = 'An error occurred during the upload.';
    });

    // Send the request
    xhr.send(formData);
});
