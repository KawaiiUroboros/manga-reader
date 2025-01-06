package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

const (
	uploadPath    = "./uploads"
	maxUploadSize = 100 << 20 // 100 MB
	defaultPort   = "10000"
)

// Manga struct to hold manga data in memory
type Manga struct {
	Title    string
	Chapters []Chapter
}

type Chapter struct {
	Number string
	Pages  []string
}

var mangaList []Manga

func main() {
	// Create the uploads directory if it doesn't exist
	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		os.MkdirAll(uploadPath, 0755)
	}

	r := mux.NewRouter()

	r.HandleFunc("/upload", uploadHandler).Methods("POST")
	r.HandleFunc("/manga", getMangaList).Methods("GET")
	r.HandleFunc("/manga/{title}", getMangaChapters).Methods("GET")
	r.HandleFunc("/manga/{title}/{chapter}", getChapterPages).Methods("GET")
	r.HandleFunc("/manga/{title}/{chapter}/{page}", getMangaPage).Methods("GET")

	// Serve static files from the "static" directory
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	fmt.Printf("Server started on http://0.0.0.0:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Limit upload size
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "File too large", http.StatusBadRequest)
		return
	}

	// Get the manga title and chapter number from the form
	mangaTitle := r.FormValue("manga")
	chapterNumber := r.FormValue("chapter")

	// Create the directory structure if it doesn't exist: uploads/mangaTitle/chapterNumber
	dirPath := filepath.Join(uploadPath, mangaTitle, chapterNumber)
	if err := os.MkdirAll(dirPath, 0755); err != nil {
		http.Error(w, "Error creating directory", http.StatusInternalServerError)
		return
	}

	// Get the file from the form data
	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Invalid file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Create a new file on the server
	filePath := filepath.Join(dirPath, handler.Filename)
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Error creating file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the new file
	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "Error saving file", http.StatusInternalServerError)
		return
	}

	// Unzip the uploaded file
	if err := unzip(filePath, filepath.Join(uploadPath, mangaTitle, chapterNumber)); err != nil {
		http.Error(w, "Error unzipping file", http.StatusInternalServerError)
		return
	}

	// Update mangaList
	updateMangaList(mangaTitle, chapterNumber, dirPath)

	fmt.Fprintf(w, "File uploaded and unzipped successfully: %s\n", handler.Filename)
}

func unzip(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()

		fpath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, f.Mode())
		} else {
			var fdir string
			if lastIndex := strings.LastIndex(fpath, string(os.PathSeparator)); lastIndex > -1 {
				fdir = fpath[:lastIndex]
			}

			err = os.MkdirAll(fdir, f.Mode())
			if err != nil {
				log.Fatal(err)
				return err
			}
			f, err := os.OpenFile(
				fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				return err
			}
			defer f.Close()

			_, err = io.Copy(f, rc)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func updateMangaList(mangaTitle, chapterNumber, dirPath string) {
	// Check if manga exists
	mangaIndex := -1
	for i, m := range mangaList {
		if m.Title == mangaTitle {
			mangaIndex = i
			break
		}
	}

	// If manga doesn't exist, add it
	if mangaIndex == -1 {
		mangaList = append(mangaList, Manga{Title: mangaTitle})
		mangaIndex = len(mangaList) - 1
	}

	// Get the list of pages
	var pages []string
	files, err := os.ReadDir(dirPath)
	if err != nil {
		log.Printf("Error reading directory: %v", err)
		return
	}

	for _, file := range files {
		if !file.IsDir() {
			pages = append(pages, file.Name())
		}
	}

	// Sort pages
	sort.Strings(pages)

	// Add chapter to manga
	chapter := Chapter{Number: chapterNumber, Pages: pages}
	mangaList[mangaIndex].Chapters = append(mangaList[mangaIndex].Chapters, chapter)
}

func getMangaList(w http.ResponseWriter, r *http.Request) {
	var titles []string
	for _, m := range mangaList {
		titles = append(titles, m.Title)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(titles)
}

func getMangaChapters(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	mangaTitle := vars["title"]

	// Find the manga
	var foundManga *Manga
	for i := range mangaList {
		if mangaList[i].Title == mangaTitle {
			foundManga = &mangaList[i]
			break
		}
	}

	if foundManga == nil {
		http.NotFound(w, r)
		return
	}

	// Extract chapter numbers
	var chapterNumbers []string
	for _, c := range foundManga.Chapters {
		chapterNumbers = append(chapterNumbers, c.Number)
	}

	// Respond with JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chapterNumbers); err != nil {
		http.Error(w, "Error encoding chapters to JSON", http.StatusInternalServerError)
		return
	}
}

func getChapterPages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	mangaTitle := vars["title"]
	chapterNumber := vars["chapter"]

	// Find the manga
	var foundManga *Manga
	for i := range mangaList {
		if mangaList[i].Title == mangaTitle {
			foundManga = &mangaList[i]
			break
		}
	}

	if foundManga == nil {
		http.NotFound(w, r)
		return
	}

	// Find the chapter
	var foundChapter *Chapter
	for i := range foundManga.Chapters {
		if foundManga.Chapters[i].Number == chapterNumber {
			foundChapter = &foundManga.Chapters[i]
			break
		}
	}

	if foundChapter == nil {
		http.NotFound(w, r)
		return
	}

	// Respond with JSON
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(foundChapter.Pages); err != nil {
		http.Error(w, "Error encoding pages to JSON", http.StatusInternalServerError)
		return
	}
}

func getMangaPage(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	mangaTitle := vars["title"]
	chapterNumber := vars["chapter"]
	pageNumber := vars["page"]

	// Validate page number
	pageNumberInt, err := strconv.Atoi(pageNumber)
	if err != nil {
		http.Error(w, "Invalid page number", http.StatusBadRequest)
		return
	}

	// Find the manga
	for _, m := range mangaList {
		if m.Title == mangaTitle {
			for _, c := range m.Chapters {
				if c.Number == chapterNumber {
					// Validate page number
					if pageNumberInt < 0 || pageNumberInt >= len(c.Pages) {
						http.Error(w, "Page number out of range", http.StatusBadRequest)
						return
					}

					page := c.Pages[pageNumberInt]
					filePath := filepath.Join(uploadPath, mangaTitle, chapterNumber, page)

					// Serve the file
					http.ServeFile(w, r, filePath)
					return
				}
			}
		}
	}

	http.NotFound(w, r) // Manga, chapter, or page not found
}
