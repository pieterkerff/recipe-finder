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
const sortSelect = document.getElementById('sortSelect'); // NEW: Sort dropdown
const quickFiltersContainer = document.querySelector('.quick-filters'); // NEW: Quick filters
const paginationControls = document.getElementById('pagination-controls'); // NEW: Pagination
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
const backendBaseUrl = 'https://azealle-recipe-finder.onrender.com';
const autocompleteUrl = `${backendBaseUrl}/ingredient-autocomplete`;

// --- State ---
let isSidebarOpen = false;
let currentSearchQuery = ''; // Store the main keyword query
let currentFilters = {}; // Store active filter values from sidebar
let currentSort = 'meta-score'; // Default sort
let currentPage = 1;
const resultsPerPage = 12; // Number of recipes per page
let totalResults = 0;
let autocompleteAbortController = null; // To cancel pending autocomplete requests

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

// Function to toggle the filter sidebar
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

// Function to update the filter count badge
function updateFilterCount() {
    let count = 0;
    // Use currentFilters state instead of reading DOM every time for badge count
    const activeFilters = getCurrentFilters(); // Get currently set filters
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

// Function to get current filter values from sidebar DOM
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

// Function to apply filters (sets state and updates badge)
function applyCurrentFilters() {
    currentFilters = getCurrentFilters();
    updateFilterCount();
}

// Function to clear all filters in sidebar and state
function clearAllFilters() {
    includeIngredientsInput.value = '';
    excludeIngredientsInput.value = '';
    cuisineSelect.value = '';
    dietSelect.value = '';
    typeSelect.value = '';
    maxReadyTimeInput.value = '';
    intoleranceCheckboxes.forEach(cb => cb.checked = false);
    currentFilters = {}; // Clear filter state
    updateFilterCount();
    // Optional: Immediately search after clearing
    // startSearch(true); // Trigger a new search
}

// Function to trigger visual feedback on filter button
function showFilterAppliedFeedback() {
    filterToggleButton.classList.add('filter-applied-pulse');
    setTimeout(() => {
        filterToggleButton.classList.remove('filter-applied-pulse');
    }, 600); // Match animation duration
}

// Main function to initiate a search (resets page, applies filters)
function startSearch(triggeredByApply = false) {
    currentSearchQuery = searchInput.value.trim(); // Get main keyword
    currentPage = 1; // Reset to first page for new search/filter application
    applyCurrentFilters(); // Store the currently selected filters

    if (triggeredByApply) {
        showFilterAppliedFeedback();
        if (isSidebarOpen) {
            toggleFilterSidebar();
        }
    }
    fetchAndDisplayRecipes(); // Fetch the first page
}


// Function to fetch recipes for the current state (page, filters, sort)
async function fetchAndDisplayRecipes() {
    searchResultsContainer.innerHTML = '<div id="loading-message"><p>Searching for recipes...</p></div>';
    paginationControls.style.display = 'none'; // Hide pagination while loading

    // Calculate offset for pagination
    const offset = (currentPage - 1) * resultsPerPage;

    // --- Construct query parameters ---
    const params = new URLSearchParams();
    if (currentSearchQuery) params.append('query', currentSearchQuery); // Main keyword

    // Add active filters from state
    Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) {
            params.append(key, value);
        }
    });

    // Add sorting
    params.append('sort', currentSort);
    // Add sortDirection if needed (e.g., for time, price) - Example:
    // if (currentSort === 'time' || currentSort === 'price') {
    //     params.append('sortDirection', 'asc'); // or 'desc' based on UI element
    // }

    // Add pagination
    params.append('number', resultsPerPage);
    params.append('offset', offset);

    const fetchUrl = `${backendBaseUrl}/recipes?${params.toString()}`;

    try {
        console.log(`Fetching from backend: ${fetchUrl}`);
        const response = await fetch(fetchUrl);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        totalResults = data.totalResults || 0; // Store total results count
        displayRecipes(data.results); // Display recipes for current page
        updatePaginationControls(); // Update pagination UI

    } catch (error) {
        console.error("Error fetching recipes from backend:", error);
        searchResultsContainer.innerHTML = `<p class="no-results-message">😕 Sorry, couldn't fetch recipes. Error: ${error.message}. Check the console and backend server.</p>`;
        totalResults = 0; // Reset total results on error
        updatePaginationControls(); // Update pagination to show error state (optional)
    }
    updateFilterCount(); // Ensure badge is accurate
}

// Function to display recipes cards (Keep mostly the same, just clear container first)
function displayRecipes(recipes) {
    searchResultsContainer.innerHTML = ''; // Clear loading/previous

    if (!recipes || recipes.length === 0) {
        if (currentPage === 1) { // Only show 'no results' on the first page
           searchResultsContainer.innerHTML = '<p class="no-results-message">😕 No recipes found matching your criteria. Try broadening your search!</p>';
        } else {
            // Optional: Could indicate "no more results" on later pages
             searchResultsContainer.innerHTML = '<p class="no-results-message">End of results.</p>';
        }
        return;
    }

    // (Keep the rest of the card creation logic from previous version)
    recipes.forEach((recipe, index) => {
        const recipeCard = document.createElement('div');
        recipeCard.classList.add('recipe-card');
        recipeCard.style.animationDelay = `${index * 0.08}s`;

        const link = document.createElement('a');
        link.href = `recipe.html?id=${recipe.id}`;

        const image = document.createElement('img');
        image.src = recipe.image || 'placeholder.jpg';
        image.alt = recipe.title;
        image.loading = 'lazy';
        link.appendChild(image);

        const textContentDiv = document.createElement('div');
        textContentDiv.classList.add('card-content');

        const title = document.createElement('h3');
        title.textContent = recipe.title;
        textContentDiv.appendChild(title);

        const metaInfoDiv = document.createElement('div');
        metaInfoDiv.classList.add('card-meta');
        if (recipe.readyInMinutes) { /* Add time */
            const timeSpan = document.createElement('span'); timeSpan.classList.add('card-meta-item', 'time'); timeSpan.innerHTML = `<span>⏰</span> ${recipe.readyInMinutes} min`; metaInfoDiv.appendChild(timeSpan);
        }
        if (recipe.servings) { /* Add servings */
            const servingsSpan = document.createElement('span'); servingsSpan.classList.add('card-meta-item', 'servings'); servingsSpan.innerHTML = `<span>👥</span> ${recipe.servings} servings`; metaInfoDiv.appendChild(servingsSpan);
        }
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

// --- Autocomplete Functions ---
const handleIngredientAutocomplete = debounce(async (inputElement, suggestionsContainer) => {
    const query = inputElement.value.trim();
    suggestionsContainer.innerHTML = ''; // Clear previous suggestions
    suggestionsContainer.style.display = 'none';

    if (query.length < 2) { // Only search if query is long enough
        return;
    }

    // Abort previous request if any
    if (autocompleteAbortController) {
        autocompleteAbortController.abort();
    }
    autocompleteAbortController = new AbortController();
    const signal = autocompleteAbortController.signal;

    try {
        const response = await fetch(`${backendBaseUrl}/ingredient-autocomplete?query=${encodeURIComponent(query)}`, { signal });
        if (!response.ok) { throw new Error('Autocomplete fetch failed'); }
        const suggestions = await response.json();
        displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Autocomplete fetch aborted');
        } else {
            console.error("Error fetching autocomplete suggestions:", error);
        }
    }
}, 300); // 300ms debounce delay

function displayAutocompleteSuggestions(suggestions, inputElement, suggestionsContainer) {
    suggestionsContainer.innerHTML = ''; // Clear again just in case
    if (suggestions && suggestions.length > 0) {
        const ul = document.createElement('ul');
        suggestions.forEach(suggestion => {
            const li = document.createElement('li');
            li.textContent = suggestion.name;
            li.addEventListener('click', () => {
                // Append suggestion to existing comma-separated list or replace
                const currentValue = inputElement.value.trim();
                const parts = currentValue.split(',').map(p => p.trim()).filter(p => p !== '');
                // If clicking a suggestion, replace the last part being typed
                if (parts.length > 0 && currentValue.slice(-1) !== ',') {
                    parts[parts.length - 1] = suggestion.name; // Replace last part
                } else {
                    parts.push(suggestion.name); // Add new ingredient
                }
                inputElement.value = parts.join(', ') + ', '; // Join and add comma/space
                suggestionsContainer.innerHTML = ''; // Clear suggestions
                suggestionsContainer.style.display = 'none';
                inputElement.focus(); // Return focus
            });
            ul.appendChild(li);
        });
        suggestionsContainer.appendChild(ul);
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

// --- Pagination Update Function ---
function updatePaginationControls() {
    if (totalResults <= resultsPerPage) {
        paginationControls.style.display = 'none'; // Hide if only one page or less
        return;
    }

    paginationControls.style.display = 'flex'; // Show controls
    const totalPages = Math.ceil(totalResults / resultsPerPage);

    pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;

    prevPageButton.disabled = (currentPage === 1);
    nextPageButton.disabled = (currentPage === totalPages);
}


// --- Event Listeners ---

// Main search button
searchButton.addEventListener('click', () => startSearch(false));

// Trigger main search on Enter in main input
searchInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') { startSearch(false); }
});

// Filter sidebar toggle button
filterToggleButton.addEventListener('click', toggleFilterSidebar);
closeFilterSidebarButton.addEventListener('click', toggleFilterSidebar);
overlay.addEventListener('click', toggleFilterSidebar);

// Apply filters button inside sidebar
applyFiltersButton.addEventListener('click', () => startSearch(true));

// Clear filters button inside sidebar
clearFiltersButton.addEventListener('click', clearAllFilters);

// Update filter count badge whenever a filter input changes IN THE SIDEBAR
document.querySelectorAll('#filterSidebar input, #filterSidebar select').forEach(input => {
    input.addEventListener('change', updateFilterCount);
});

// Close sidebar on Escape key press
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isSidebarOpen) { toggleFilterSidebar(); }
});

// Sort select change listener
sortSelect.addEventListener('change', (event) => {
    currentSort = event.target.value;
    currentPage = 1; // Reset to page 1 when sort changes
    fetchAndDisplayRecipes();
});

// Pagination button listeners
prevPageButton.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        fetchAndDisplayRecipes();
    }
});
nextPageButton.addEventListener('click', () => {
    const totalPages = Math.ceil(totalResults / resultsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        fetchAndDisplayRecipes();
    }
});

// Quick Filter tag listeners (using event delegation)
quickFiltersContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('quick-filter-tag')) {
        const filterType = event.target.dataset.filterType;
        const filterValue = event.target.dataset.filterValue;

        // Clear existing filters first? Or just apply this one? Let's just apply.
        // clearAllFilters(); // Optional: uncomment to clear before applying quick filter

        if (filterType === 'cuisine') cuisineSelect.value = filterValue;
        if (filterType === 'diet') dietSelect.value = filterValue;
        if (filterType === 'type') typeSelect.value = filterValue;

        startSearch(false); // Start search, don't indicate it was sidebar apply
    }
});

// Autocomplete listeners
includeIngredientsInput.addEventListener('input', () => {
    handleIngredientAutocomplete(includeIngredientsInput, includeSuggestionsContainer);
});
excludeIngredientsInput.addEventListener('input', () => {
    handleIngredientAutocomplete(excludeIngredientsInput, excludeSuggestionsContainer);
});
// Hide autocomplete suggestions on input blur
includeIngredientsInput.addEventListener('blur', () => setTimeout(() => { includeSuggestionsContainer.style.display = 'none'; }, 150)); // Delay allows click
excludeIngredientsInput.addEventListener('blur', () => setTimeout(() => { excludeSuggestionsContainer.style.display = 'none'; }, 150));

// --- Initial Load ---
updateFilterCount(); // Initial count check (should be 0)
// Optional: Trigger an initial empty search or display placeholder
// searchResultsContainer.innerHTML = '<p id="initial-placeholder">Enter search criteria above and click Search!</p>';