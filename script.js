// script.js (Handles search, filters via SIDEBAR, sorting, pagination, autocomplete, etc.)

// --- DOM Elements ---
const searchResultsContainer = document.getElementById('recipe-results');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const filterToggleButton = document.getElementById('filterToggleButton');
const filterSidebar = document.getElementById('filterSidebar');
const closeFilterSidebarButton = document.getElementById('closeFilterSidebarButton');
const overlay = document.getElementById('overlay');
const applyFiltersButton = document.getElementById('applyFiltersButton');
const clearFiltersButton = document.getElementById('clearFiltersButton');
const filterCountBadge = document.getElementById('filter-count-badge');
const sortSelect = document.getElementById('sortSelect');
const quickFiltersContainer = document.querySelector('.quick-filters');
const paginationControls = document.getElementById('pagination-controls');
const prevPageButton = document.getElementById('prevPageButton');
const nextPageButton = document.getElementById('nextPageButton');
const pageInfoSpan = document.getElementById('page-info');

// Filter Input Elements (inside sidebar)
const includeIngredientsInput = document.getElementById('includeIngredients');
const excludeIngredientsInput = document.getElementById('excludeIngredients');
const includeSuggestionsContainer = document.getElementById('include-suggestions');
const excludeSuggestionsContainer = document.getElementById('exclude-suggestions');
const cuisineSelect = document.getElementById('cuisineSelect');
const dietSelect = document.getElementById('dietSelect');
const typeSelect = document.getElementById('typeSelect');
const maxReadyTimeInput = document.getElementById('maxReadyTime');
const intoleranceCheckboxes = document.querySelectorAll('input[name="intolerance"]');

// --- API Configuration ---
// !!! IMPORTANT: Replace with YOUR deployed backend URL !!!
const backendBaseUrl = 'https://azealle-recipe-finder.onrender.com/api'; // e.g., 'https://my-recipe-backend.onrender.com/api'
// !!! Make sure it's HTTPS !!!

// Derive other endpoints from base URL
const backendApiUrl = `${backendBaseUrl}/recipes`;
const autocompleteUrl = `${backendBaseUrl}/ingredient-autocomplete`;

// --- State ---
let isSidebarOpen = false;
let currentSearchQuery = '';
let currentFilters = {};
let currentSort = 'meta-score';
let currentPage = 1;
const resultsPerPage = 12;
let totalResults = 0;
let autocompleteAbortController = null;

// --- Debounce Function ---
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- Functions ---

function toggleFilterSidebar() {
    isSidebarOpen = !isSidebarOpen;
    filterSidebar.hidden = !isSidebarOpen;
    overlay.hidden = !isSidebarOpen;
    document.body.classList.toggle('sidebar-open-overlay', isSidebarOpen);
    filterToggleButton.setAttribute('aria-expanded', isSidebarOpen);
    if (isSidebarOpen) { closeFilterSidebarButton.focus(); }
    else { filterToggleButton.focus(); }
    updateFilterCount();
}

function updateFilterCount() {
    let count = 0;
    const activeFilters = getCurrentFilters();
    if (activeFilters.includeIngredients) count++;
    if (activeFilters.excludeIngredients) count++;
    if (activeFilters.cuisine) count++;
    if (activeFilters.diet) count++;
    if (activeFilters.type) count++;
    if (activeFilters.maxReadyTime) count++;
    if (activeFilters.intolerances) count += activeFilters.intolerances.split(',').length;

    if (count > 0) {
        filterCountBadge.textContent = count;
        filterCountBadge.style.display = 'inline-block';
        filterToggleButton.classList.add('has-filters');
    } else {
        filterCountBadge.style.display = 'none';
        filterToggleButton.classList.remove('has-filters');
    }
}

function getCurrentFilters() {
    const intolerances = Array.from(document.querySelectorAll('input[name="intolerance"]:checked'))
                            .map(cb => cb.value)
                            .join(',');
    return {
        includeIngredients: includeIngredientsInput.value.trim(),
        excludeIngredients: excludeIngredientsInput.value.trim(),
        cuisine: cuisineSelect.value,
        diet: dietSelect.value,
        type: typeSelect.value,
        maxReadyTime: maxReadyTimeInput.value.trim(),
        intolerances: intolerances
    };
}

function applyCurrentFilters() {
    currentFilters = getCurrentFilters();
    updateFilterCount();
}

function clearAllFilters() {
    includeIngredientsInput.value = '';
    excludeIngredientsInput.value = '';
    cuisineSelect.value = '';
    dietSelect.value = '';
    typeSelect.value = '';
    maxReadyTimeInput.value = '';
    intoleranceCheckboxes.forEach(cb => cb.checked = false);
    currentFilters = {};
    updateFilterCount();
}

function showFilterAppliedFeedback() {
    filterToggleButton.classList.add('filter-applied-pulse');
    setTimeout(() => {
        filterToggleButton.classList.remove('filter-applied-pulse');
    }, 600);
}

function startSearch(triggeredByApply = false) {
    currentSearchQuery = searchInput.value.trim();
    currentPage = 1;
    applyCurrentFilters();

    if (triggeredByApply) {
        showFilterAppliedFeedback();
        if (isSidebarOpen) {
            toggleFilterSidebar();
        }
    }
    fetchAndDisplayRecipes();
}

async function fetchAndDisplayRecipes() {
    searchResultsContainer.innerHTML = '<div id="loading-message"><p>Searching for recipes...</p></div>';
    paginationControls.style.display = 'none';

    const offset = (currentPage - 1) * resultsPerPage;
    const params = new URLSearchParams();
    if (currentSearchQuery) params.append('query', currentSearchQuery);
    Object.entries(currentFilters).forEach(([key, value]) => { if (value) { params.append(key, value); } });
    params.append('sort', currentSort);
    params.append('number', resultsPerPage);
    params.append('offset', offset);

    const fetchUrl = `${backendApiUrl}?${params.toString()}`; // Use derived URL

    try {
        console.log(`Fetching from backend: ${fetchUrl}`);
        const response = await fetch(fetchUrl);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        totalResults = data.totalResults || 0;
        displayRecipes(data.results);
        updatePaginationControls();

    } catch (error) {
        console.error("Error fetching recipes from backend:", error);
        searchResultsContainer.innerHTML = `<p class="no-results-message">😕 Sorry, couldn't fetch recipes. Error: ${error.message}. Check the console and backend server.</p>`;
        totalResults = 0;
        updatePaginationControls();
    }
    updateFilterCount();
}

function displayRecipes(recipes) {
    searchResultsContainer.innerHTML = '';

    if (!recipes || recipes.length === 0) {
        searchResultsContainer.innerHTML = currentPage === 1
            ? '<p class="no-results-message">😕 No recipes found matching your criteria. Try broadening your search!</p>'
            : '<p class="no-results-message">End of results.</p>';
        return;
    }

    recipes.forEach((recipe, index) => {
        const recipeCard = document.createElement('div');
        recipeCard.classList.add('recipe-card');
        recipeCard.style.animationDelay = `${index * 0.08}s`;
        const link = document.createElement('a'); link.href = `recipe.html?id=${recipe.id}`;
        const image = document.createElement('img'); image.src = recipe.image || 'placeholder.jpg'; image.alt = recipe.title; image.loading = 'lazy'; link.appendChild(image);
        const textContentDiv = document.createElement('div'); textContentDiv.classList.add('card-content');
        const title = document.createElement('h3'); title.textContent = recipe.title; textContentDiv.appendChild(title);
        const metaInfoDiv = document.createElement('div'); metaInfoDiv.classList.add('card-meta');
        if (recipe.readyInMinutes) { const t = document.createElement('span'); t.classList.add('card-meta-item', 'time'); t.innerHTML = `<span>⏰</span> ${recipe.readyInMinutes} min`; metaInfoDiv.appendChild(t); }
        if (recipe.servings) { const s = document.createElement('span'); s.classList.add('card-meta-item', 'servings'); s.innerHTML = `<span>👥</span> ${recipe.servings} servings`; metaInfoDiv.appendChild(s); }
        if (metaInfoDiv.hasChildNodes()){ textContentDiv.appendChild(metaInfoDiv); }
        const dietaryIconsDiv = document.createElement('div'); dietaryIconsDiv.classList.add('card-dietary-icons'); let addedIcon = false;
        if (recipe.vegetarian) { const i=document.createElement('span'); i.classList.add('diet-icon', 'veg'); i.title='Vegetarian'; i.textContent=' V '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (recipe.vegan) { const i=document.createElement('span'); i.classList.add('diet-icon', 'vegan'); i.title='Vegan'; i.textContent=' Vg '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (recipe.glutenFree) { const i=document.createElement('span'); i.classList.add('diet-icon', 'gf'); i.title='Gluten Free'; i.textContent=' GF '; dietaryIconsDiv.appendChild(i); addedIcon = true; }
        if (addedIcon) { textContentDiv.appendChild(dietaryIconsDiv); }
        link.appendChild(textContentDiv);
        recipeCard.appendChild(link);
        searchResultsContainer.appendChild(recipeCard);
    });
}

const handleIngredientAutocomplete = debounce(async (inputElement, suggestionsContainer) => {
    const query = inputElement.value.trim();
    suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none';
    if (query.length < 2) return;
    if (autocompleteAbortController) autocompleteAbortController.abort();
    autocompleteAbortController = new AbortController();
    const signal = autocompleteAbortController.signal;

    try {
        // Use derived autocompleteUrl
        const response = await fetch(`${autocompleteUrl}?query=${encodeURIComponent(query)}`, { signal });
        if (!response.ok) { throw new Error('Autocomplete fetch failed'); }
        const suggestions = await response.json();
        displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer);
    } catch (error) {
        if (error.name !== 'AbortError') console.error("Error fetching autocomplete:", error);
    }
}, 300);

function displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer) {
    suggestionsContainer.innerHTML = '';
    if (suggestions && suggestions.length > 0) {
        const ul = document.createElement('ul');
        suggestions.forEach(suggestion => {
            const li = document.createElement('li'); li.textContent = suggestion.name;
            li.addEventListener('click', () => {
                const currentValue = inputElement.value.trim(); const parts = currentValue.split(',').map(p => p.trim()).filter(p => p !== '');
                if (parts.length > 0 && !currentValue.endsWith(',')) { parts[parts.length - 1] = suggestion.name; }
                else { parts.push(suggestion.name); }
                inputElement.value = parts.join(', ') + ', ';
                suggestionsContainer.innerHTML = ''; suggestionsContainer.style.display = 'none'; inputElement.focus();
            });
            ul.appendChild(li);
        });
        suggestionsContainer.appendChild(ul); suggestionsContainer.style.display = 'block';
    } else { suggestionsContainer.style.display = 'none'; }
}

function updatePaginationControls() {
    if (totalResults <= resultsPerPage) { paginationControls.style.display = 'none'; return; }
    paginationControls.style.display = 'flex';
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageButton.disabled = (currentPage === 1);
    nextPageButton.disabled = (currentPage === totalPages);
}

// --- Event Listeners ---
searchButton.addEventListener('click', () => startSearch(false));
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') startSearch(false); });
filterToggleButton.addEventListener('click', toggleFilterSidebar);
closeFilterSidebarButton.addEventListener('click', toggleFilterSidebar);
overlay.addEventListener('click', toggleFilterSidebar);
applyFiltersButton.addEventListener('click', () => startSearch(true));
clearFiltersButton.addEventListener('click', clearAllFilters);
document.querySelectorAll('#filterSidebar input, #filterSidebar select').forEach(input => { input.addEventListener('change', updateFilterCount); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isSidebarOpen) toggleFilterSidebar(); });
sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; currentPage = 1; fetchAndDisplayRecipes(); });
prevPageButton.addEventListener('click', () => { if (currentPage > 1) { currentPage--; fetchAndDisplayRecipes(); } });
nextPageButton.addEventListener('click', () => { const totalPages = Math.ceil(totalResults / resultsPerPage); if (currentPage < totalPages) { currentPage++; fetchAndDisplayRecipes(); } });
quickFiltersContainer.addEventListener('click', (e) => { if (e.target.classList.contains('quick-filter-tag')) { const type = e.target.dataset.filterType; const value = e.target.dataset.filterValue; if (type === 'cuisine') cuisineSelect.value = value; if (type === 'diet') dietSelect.value = value; if (type === 'type') typeSelect.value = value; startSearch(false); } });
includeIngredientsInput.addEventListener('input', () => handleIngredientAutocomplete(includeIngredientsInput, includeSuggestionsContainer));
excludeIngredientsInput.addEventListener('input', () => handleIngredientAutocomplete(excludeIngredientsInput, excludeSuggestionsContainer));
includeIngredientsInput.addEventListener('blur', () => setTimeout(() => { includeSuggestionsContainer.style.display = 'none'; }, 150));
excludeIngredientsInput.addEventListener('blur', () => setTimeout(() => { excludeSuggestionsContainer.style.display = 'none'; }, 150));

// --- Initial Load ---
updateFilterCount();
