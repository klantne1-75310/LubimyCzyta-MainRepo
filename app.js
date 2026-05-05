document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://75310.pythonanywhere.com';

    const booksGrid = document.getElementById('booksGrid');
    const searchInput = document.getElementById('searchInput');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const statusBox = document.getElementById('statusBox');
    const showMoreContainer = document.getElementById('showMoreContainer');
    const showMoreButton = document.getElementById('showMoreButton');
    const detailPanel = document.getElementById('detailPanel');
    const detailPanelContent = document.getElementById('detailPanelContent');

    const statBooks = document.getElementById('statBooks');
    const statAuthors = document.getElementById('statAuthors');
    const statGenres = document.getElementById('statGenres');
    const statPublishers = document.getElementById('statPublishers');

    const refreshDataBtn = document.getElementById('refreshDataBtn');
    const reloadTopBtn = document.getElementById('reloadTopBtn');
    const showAllBtn = document.getElementById('showAllBtn');

    let allBooks = [];
    let filteredBooks = [];
    let currentFilter = 'all';
    let currentQuery = '';
    let visibleCount = 18;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    function setStatus(message, type = '') {
        statusBox.className = `status-box ${type}`.trim();
        statusBox.textContent = message;
    }

    function getBookGradient(id) {
        const safeId = Number(id) || 1;
        const hue = (safeId * 47) % 360;
        return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 55) % 360}, 70%, 35%))`;
    }

    async function loadDatabase() {
        setStatus('Ładowanie danych z backendu...');

        const response = await fetch(`${API_URL}/api/books`);

        if (!response.ok) {
            throw new Error(`Backend zwrócił błąd HTTP ${response.status}`);
        }

        const result = await response.json();

        const books = result.books || [];
        const stats = result.stats || {};
        const warnings = result.warnings || [];

        allBooks = books.map(book => ({
            id: book.id,
            title: book.title,
            year: book.year,
            authors: Array.isArray(book.authors) ? book.authors : [],
                                      genres: Array.isArray(book.genres) ? book.genres : [],
                                      publishers: Array.isArray(book.publishers) ? book.publishers : [],
                                      gradient: getBookGradient(book.id)
        }));

        statBooks.textContent = stats.books ?? allBooks.length;
        statAuthors.textContent = stats.authors ?? 0;
        statGenres.textContent = stats.genres ?? 0;
        statPublishers.textContent = stats.publishers ?? 0;

        if (warnings.length) {
            setStatus(
                `Załadowano książki, ale nie udało się pobrać części tabel: ${warnings.join(', ')}`,
                      'warning'
            );
        } else {
            setStatus(`Załadowano ${allBooks.length} książek z backendu.`);
        }

        applyFilters();
    }

    function applyFilters() {
        visibleCount = 18;

        let result = [...allBooks];
        const query = currentQuery.trim().toLowerCase();

        if (query) {
            result = result.filter(book => {
                const haystack = [
                    book.title,
                    String(book.year ?? ''),
                                   ...book.authors,
                                   ...book.genres,
                                   ...book.publishers
                ].join(' | ').toLowerCase();

                return haystack.includes(query);
            });
        }

        if (currentFilter === 'recent') {
            result = result.filter(book => Number(book.year) >= 2000);
        } else if (currentFilter === 'classic') {
            result = result.filter(book => Number(book.year) < 2000);
        }

        filteredBooks = result;
        renderBooks();
    }

    function renderBooks() {
        if (!filteredBooks.length) {
            booksGrid.innerHTML = `
            <div class="empty-state">
            Brak książek spełniających kryteria.
            </div>
            `;

            showMoreContainer.classList.add('hidden');
            return;
        }

        const booksToShow = filteredBooks.slice(0, visibleCount);

        booksGrid.innerHTML = booksToShow.map(book => `
        <div class="book-card" data-book-id="${escapeHtml(String(book.id))}">
        <div class="book-cover" style="background: ${book.gradient}">
        <div class="book-title">${escapeHtml(book.title || 'Brak tytułu')}</div>
        <div class="book-author">${escapeHtml(book.authors[0] || 'Nieznany autor')}</div>
        <div class="book-year">${escapeHtml(String(book.year ?? 'Brak roku'))}</div>
        </div>
        </div>
        `).join('');

        const cards = booksGrid.querySelectorAll('.book-card');

        cards.forEach(card => {
            card.addEventListener('click', () => {
                const bookId = Number(card.dataset.bookId);
                const book = allBooks.find(item => item.id === bookId);

                if (book) {
                    openDetailPanel(book);
                }
            });
        });

        if (filteredBooks.length > visibleCount) {
            showMoreContainer.classList.remove('hidden');
        } else {
            showMoreContainer.classList.add('hidden');
        }
    }

    function openDetailPanel(book) {
        const authorsText = book.authors.length
        ? book.authors.join(', ')
        : 'Nieznany autor';

        const genresHtml = book.genres.length
        ? book.genres.map(genre => `<span class="detail-tag">${escapeHtml(genre)}</span>`).join('')
        : '<span class="detail-tag gray">Brak gatunku</span>';

        const publishersHtml = book.publishers.length
        ? book.publishers.map(publisher => `<span class="detail-tag gray">${escapeHtml(publisher)}</span>`).join('')
        : '<span class="detail-tag gray">Brak wydawcy</span>';

        detailPanelContent.innerHTML = `
        <button class="detail-close" id="detailCloseBtn">✕</button>

        <div class="detail-book-info">
        <div class="detail-cover" style="background: ${book.gradient}">
        <div class="book-title">${escapeHtml(book.title || 'Brak tytułu')}</div>
        <div class="book-author">${escapeHtml(book.authors[0] || 'Nieznany autor')}</div>
        <div class="book-year">${escapeHtml(String(book.year ?? 'Brak roku'))}</div>
        </div>

        <div class="detail-info">
        <h2>${escapeHtml(book.title || 'Brak tytułu')}</h2>

        <div class="author-name">
        ✍️ ${escapeHtml(authorsText)}
        </div>

        <div class="detail-meta">
        <div class="detail-meta-item">
        <strong>ID:</strong>
        <span>${escapeHtml(String(book.id))}</span>
        </div>

        <div class="detail-meta-item">
        <strong>Rok:</strong>
        <span>${escapeHtml(String(book.year ?? 'Brak danych'))}</span>
        </div>

        <div class="detail-meta-item">
        <strong>Autorzy:</strong>
        <span>${escapeHtml(authorsText)}</span>
        </div>
        </div>
        </div>
        </div>

        <div class="detail-description">
        <h3>Gatunki</h3>
        <div class="detail-tags">
        ${genresHtml}
        </div>

        <h3 style="margin-top: 20px;">Wydawcy</h3>
        <div class="detail-tags">
        ${publishersHtml}
        </div>

        <h3 style="margin-top: 20px;">Opis widoku</h3>
        <p>
        To jest widok danych pobranych przez backend FastAPI z bazy Supabase.
        Książka <strong>${escapeHtml(book.title || 'Brak tytułu')}</strong>
        została wydana w roku ${escapeHtml(String(book.year ?? 'brak'))}.
        </p>

        <p>
        Autorzy: ${escapeHtml(authorsText)}.
        ${book.genres.length ? `Gatunki: ${escapeHtml(book.genres.join(', '))}.` : ''}
        ${book.publishers.length ? `Wydawcy: ${escapeHtml(book.publishers.join(', '))}.` : ''}
        </p>
        </div>
        `;

        detailPanel.classList.add('active');

        document
        .getElementById('detailCloseBtn')
        .addEventListener('click', closeDetailPanel);
    }

    function closeDetailPanel() {
        detailPanel.classList.remove('active');
    }

    searchInput.addEventListener('input', event => {
        currentQuery = event.target.value;
        applyFilters();
    });

    filterBtns.forEach(button => {
        button.addEventListener('click', () => {
            filterBtns.forEach(item => item.classList.remove('active'));
            button.classList.add('active');

            currentFilter = button.dataset.filter;
            applyFilters();
        });
    });

    showMoreButton.addEventListener('click', () => {
        visibleCount += 18;
        renderBooks();
    });

    refreshDataBtn.addEventListener('click', async () => {
        try {
            await loadDatabase();
        } catch (error) {
            console.error(error);
            setStatus(`Błąd ładowania danych: ${error.message}`, 'error');
        }
    });

    reloadTopBtn.addEventListener('click', async () => {
        try {
            await loadDatabase();
        } catch (error) {
            console.error(error);
            setStatus(`Błąd ładowania danych: ${error.message}`, 'error');
        }
    });

    showAllBtn.addEventListener('click', () => {
        currentQuery = '';
        searchInput.value = '';
        currentFilter = 'all';

        filterBtns.forEach(button => button.classList.remove('active'));
        document.querySelector('[data-filter="all"]').classList.add('active');

        applyFilters();
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeDetailPanel();
        }
    });

    loadDatabase().catch(error => {
        console.error(error);

        setStatus(`Błąd ładowania danych: ${error.message}`, 'error');

        booksGrid.innerHTML = `
        <div class="empty-state">
        Nie udało się załadować danych z backendu.
        </div>
        `;
    });
});
