// script.js (Handles search, filters via SIDEBAR, and displaying recipe cards)

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

// Filter Input Elements (inside sidebar)
const includeIngredientsInput = document.getElementById('includeIngredients');
const excludeIngredientsInput = document.getElementById('excludeIngredients');
const cuisineSelect = document.getElementById('cuisineSelect');
const dietSelect = document.getElementById('dietSelect');
const typeSelect = document.getElementById('typeSelect');
const maxReadyTimeInput = document.getElementById('maxReadyTime');
const intoleranceCheckboxes = document.querySelectorAll('input[name="intolerance"]');

// --- API Configuration ---
const backendApiUrl = 'http://localhost:3000/api/recipes'; // Search endpoint

// --- State ---
let isSidebarOpen = false;

// --- Functions ---

// Function to toggle the filter sidebar
function toggleFilterSidebar() {
    isSidebarOpen = !isSidebarOpen;
    filterSidebar.hidden = !isSidebarOpen;
    overlay.hidden = !isSidebarOpen;

    // Add class to body for overlay effect OR content push effect
    // Option 1: Overlay
    document.body.classList.toggle('sidebar-open-overlay', isSidebarOpen);
    // Option 2: Push content (Uncomment below and comment out Option 1)
    // document.body.classList.toggle('sidebar-open-push', isSidebarOpen);

    // Update ARIA attributes
    filterToggleButton.setAttribute('aria-expanded', isSidebarOpen);

    if (isSidebarOpen) {
        // Optional: Focus the first element in the sidebar
        closeFilterSidebarButton.focus();
    } else {
        filterToggleButton.focus(); // Return focus to the toggle button
    }
    updateFilterCount(); // Update count when sidebar opens/closes
}

// Function to update the filter count badge
function updateFilterCount() {
    let count = 0;
    if (includeIngredientsInput.value.trim()) count++;
    if (excludeIngredientsInput.value.trim()) count++;
    if (cuisineSelect.value) count++;
    if (dietSelect.value) count++;
    if (typeSelect.value) count++;
    if (maxReadyTimeInput.value.trim()) count++;
    count += document.querySelectorAll('input[name="intolerance"]:checked').length;

    if (count > 0) {
        filterCountBadge.textContent = count;
        filterCountBadge.style.display = 'inline-block';
        filterToggleButton.classList.add('has-filters'); // Optional class for styling button
    } else {
        filterCountBadge.style.display = 'none';
         filterToggleButton.classList.remove('has-filters');
    }
}

// Function to clear all filters
function clearAllFilters() {
    includeIngredientsInput.value = '';
    excludeIngredientsInput.value = '';
    cuisineSelect.value = '';
    dietSelect.value = '';
    typeSelect.value = '';
    maxReadyTimeInput.value = '';
    intoleranceCheckboxes.forEach(cb => cb.checked = false);
    updateFilterCount();
    // Optional: Immediately search after clearing filters
    // searchRecipes();
}

// Main function to fetch and display recipes
async function searchRecipes(triggeredByApply = false) {
    // Close sidebar if search was triggered by Apply button
    if (triggeredByApply && isSidebarOpen) {
        toggleFilterSidebar();
    }

    searchResultsContainer.innerHTML = '<div id="loading-message"><p>Searching for recipes...</p></div>';

    // --- Gather all filter values (from sidebar elements now) ---
    const query = searchInput.value.trim(); // Get main keyword search
    const includeIngredients = includeIngredientsInput.value.trim();
    const excludeIngredients = excludeIngredientsInput.value.trim();
    const cuisine = cuisineSelect.value;
    const diet = dietSelect.value;
    const type = typeSelect.value;
    const maxReadyTime = maxReadyTimeInput.value.trim();
    const intolerances = Array.from(document.querySelectorAll('input[name="intolerance"]:checked'))
                            .map(cb => cb.value)
                            .join(',');

    // --- Construct query parameters ---
    const params = new URLSearchParams();
    if (query) params.append('query', query); // Include main search term
    if (includeIngredients) params.append('includeIngredients', includeIngredients);
    if (excludeIngredients) params.append('excludeIngredients', excludeIngredients);
    if (cuisine) params.append('cuisine', cuisine);
    if (diet) params.append('diet', diet);
    if (type) params.append('type', type);
    if (maxReadyTime) params.append('maxReadyTime', maxReadyTime);
    if (intolerances) params.append('intolerances', intolerances);

    const fetchUrl = `${backendApiUrl}?${params.toString()}`;

    try {
        console.log(`Fetching from backend: ${fetchUrl}`);
        const response = await fetch(fetchUrl);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        displayRecipes(data.results);

    } catch (error) {
        console.error("Error fetching recipes from backend:", error);
        searchResultsContainer.innerHTML = `<p class="no-results-message">😕 Sorry, couldn't fetch recipes. Error: ${error.message}. Check the console and backend server.</p>`;
    }
    updateFilterCount(); // Ensure badge is up-to-date after search
}

// Function to display recipes cards (Keep this function mostly the same as before)
function displayRecipes(recipes) {
    searchResultsContainer.innerHTML = ''; // Clear loading or previous results

    if (!recipes || recipes.length === 0) {
        searchResultsContainer.innerHTML = '<p class="no-results-message">😕 No recipes found matching your criteria. Try broadening your search!</p>';
        return;
    }

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
        if (recipe.readyInMinutes) {
            const timeSpan = document.createElement('span');
            timeSpan.classList.add('card-meta-item', 'time');
            timeSpan.innerHTML = `<span>⏰</span> ${recipe.readyInMinutes} min`;
            metaInfoDiv.appendChild(timeSpan);
        }
        if (recipe.servings) {
            const servingsSpan = document.createElement('span');
            servingsSpan.classList.add('card-meta-item', 'servings');
            servingsSpan.innerHTML = `<span>👥</span> ${recipe.servings} servings`;
            metaInfoDiv.appendChild(servingsSpan);
        }
        if (metaInfoDiv.hasChildNodes()){
            textContentDiv.appendChild(metaInfoDiv);
        }

        const dietaryIconsDiv = document.createElement('div');
        dietaryIconsDiv.classList.add('card-dietary-icons');
        let addedIcon = false;
        if (recipe.vegetarian) { /* ... create/append veg icon ... */
            const vegSpan = document.createElement('span');
             vegSpan.classList.add('diet-icon', 'veg');
             vegSpan.title = 'Vegetarian';
             vegSpan.textContent = ' V ';
             dietaryIconsDiv.appendChild(vegSpan);
             addedIcon = true;
        }
        if (recipe.vegan) { /* ... create/append vegan icon ... */
            const veganSpan = document.createElement('span');
            veganSpan.classList.add('diet-icon', 'vegan');
            veganSpan.title = 'Vegan';
            veganSpan.textContent = ' Vg ';
            dietaryIconsDiv.appendChild(veganSpan);
            addedIcon = true;
        }
        if (recipe.glutenFree) { /* ... create/append gf icon ... */
            const gfSpan = document.createElement('span');
            gfSpan.classList.add('diet-icon', 'gf');
            gfSpan.title = 'Gluten Free';
            gfSpan.textContent = ' GF ';
            dietaryIconsDiv.appendChild(gfSpan);
            addedIcon = true;
        }
        if (addedIcon) {
            textContentDiv.appendChild(dietaryIconsDiv);
        }

        link.appendChild(textContentDiv);
        recipeCard.appendChild(link);
        searchResultsContainer.appendChild(recipeCard);
    });
}

// --- Event Listeners ---

// Main search button (always includes active filters)
searchButton.addEventListener('click', () => searchRecipes(false));

// Optional: Trigger main search on Enter in main input
searchInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchRecipes(false);
    }
});

// Filter sidebar toggle button
filterToggleButton.addEventListener('click', toggleFilterSidebar);

// Close sidebar button
closeFilterSidebarButton.addEventListener('click', toggleFilterSidebar);

// Overlay click to close sidebar
overlay.addEventListener('click', toggleFilterSidebar);

// Apply filters button inside sidebar
applyFiltersButton.addEventListener('click', () => searchRecipes(true)); // Pass true

// Clear filters button inside sidebar
clearFiltersButton.addEventListener('click', clearAllFilters);

// Update filter count badge whenever a filter input changes
document.querySelectorAll('#filterSidebar input, #filterSidebar select').forEach(input => {
    input.addEventListener('change', updateFilterCount);
});

// Close sidebar on Escape key press
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isSidebarOpen) {
        toggleFilterSidebar();
    }
});

// Initial filter count update on page load
updateFilterCount();