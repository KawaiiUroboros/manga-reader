package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

const (
	uploadPath = "./uploads"
	maxUploadSize = 10 << 20 // 10 MB
)

func main() {
	// Create the uploads directory if it doesn't exist
	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		os.MkdirAll(uploadPath, 0755)
	}

	http.HandleFunc("/upload", uploadHandler)

	// Serve static files (for the frontend)
	http.Handle("/", http.FileServer(http.Dir("./static")))

	fmt.Println("Server started on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
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

	fmt.Fprintf(w, "File uploaded successfully: %s\n", handler.Filename)
}