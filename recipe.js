// recipe.js - Handles fetching and displaying recipe details, print, checklist, scroll-to-top

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const errorText = errorMessage.querySelector('p');
    const recipeContent = document.getElementById('recipe-content');
    const printButton = document.getElementById('printRecipeButton');
    const ingredientsList = document.getElementById('recipe-ingredients');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn'); // NEW

    // --- API Configuration ---
    // !!! IMPORTANT: Replace with YOUR deployed backend URL !!!
    const backendBaseUrl = 'https://azealle-recipe-finder.onrender.com/api'; // e.g., 'https://my-recipe-backend.onrender.com/api'
    // !!! Make sure it's HTTPS !!!

    // Function to display errors (Enhanced)
    function showError(error) {
        console.error("Error fetching recipe details:", error);
        loadingMessage.style.display = 'none';
        recipeContent.style.display = 'none';

        let userMessage = `😕 Sorry, couldn't load recipe details. An unexpected error occurred.`; // Default
        if (error.message) {
            const lowerCaseError = error.message.toLowerCase();
            if (lowerCaseError.includes('quota') || lowerCaseError.includes('limit')) {
                userMessage = "📋 Sorry, the daily recipe lookup limit has been reached. Please try again tomorrow!";
            } else if (lowerCaseError.includes('api key') || error.status === 401 || error.status === 403) {
                userMessage = "🔑 Oops! There seems to be an issue accessing the recipe data.";
            } else if (error.status === 402) {
                 userMessage = "📋 Sorry, the daily recipe lookup limit has been reached. Please try again tomorrow!";
            } else if (error.status === 404) {
                 userMessage = "❓ Recipe not found. It might have been removed or the link is incorrect.";
            } else {
                 userMessage = `😕 Sorry, couldn't load recipe details. Error: ${error.message}.`;
            }
        }
        errorText.textContent = userMessage;
        errorMessage.style.display = 'block';
        document.title = "Error Loading Recipe";
    }

    // Get recipe ID from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');

    if (!recipeId) {
        showError({ message: 'No recipe ID provided in the URL.' }); // Pass error object
        return;
    }

    // Construct the detail URL using the base URL
    const backendDetailUrl = `${backendBaseUrl}/recipe/${recipeId}`;

    fetch(backendDetailUrl)
        .then(response => {
            if (!response.ok) {
                 return response.json().then(errData => {
                     const error = new Error(errData.error || `Server responded with status ${response.status}`);
                     error.status = response.status; // Attach status
                     throw error;
                 }).catch((parseError) => {
                     // If parsing JSON fails, throw original status error
                     const error = new Error(`Failed to fetch details. Server responded with status ${response.status}`);
                     error.status = response.status;
                     throw error;
                 });
            }
            return response.json();
        })
        .then(data => {
            loadingMessage.style.display = 'none';
            recipeContent.style.display = 'block';

            // Populate Basic Info
            document.getElementById('recipe-title').textContent = data.title || 'N/A';
            document.getElementById('recipe-image').src = data.image || 'placeholder.jpg';
            document.getElementById('recipe-image').alt = data.title || 'Recipe image';

            // Populate Meta Info (with tooltips)
            document.getElementById('recipe-servings').innerHTML = `<span title="Servings">👥</span> ${data.servings ? data.servings : '-'}`;
            document.getElementById('recipe-time').innerHTML = `<span title="Ready in Minutes">⏰</span> ${data.readyInMinutes ? data.readyInMinutes : '-'} min`;
            const sourceLink = document.getElementById('recipe-source').querySelector('a');
            const sourceSpan = document.getElementById('recipe-source');
            if(data.sourceUrl) {
               sourceLink.href = data.sourceUrl;
               sourceLink.textContent = data.sourceName || data.creditsText || new URL(data.sourceUrl).hostname;
               sourceSpan.style.display = 'inline-flex';
               sourceSpan.title = `Source: ${sourceLink.textContent}`; // Add title attribute
            } else { sourceSpan.style.display = 'none'; }

            // Populate Summary
            const summaryElement = document.getElementById('recipe-summary');
            const summaryContent = document.getElementById('summary-content');
             if(data.summary) { summaryContent.innerHTML = data.summary; summaryElement.style.display = 'block'; }
             else { summaryElement.style.display = 'none'; }

            // Populate Ingredients (Checklist)
            ingredientsList.innerHTML = '';
            if (data.extendedIngredients && data.extendedIngredients.length > 0) {
                data.extendedIngredients.forEach(ingredient => {
                    const li = document.createElement('li'); li.textContent = ingredient.original; li.tabIndex = 0; li.title = `Check/uncheck ${ingredient.nameClean || ingredient.name}`; // Tooltip
                    li.addEventListener('click', () => li.classList.toggle('checked'));
                    li.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') { li.classList.toggle('checked'); e.preventDefault(); } });
                    ingredientsList.appendChild(li);
                });
            } else { ingredientsList.innerHTML = '<li>No ingredients listed.</li>'; }

            // Populate Instructions
            const instructionsList = document.getElementById('recipe-instructions'); instructionsList.innerHTML = ''; let instructions = [];
            if(data.analyzedInstructions && data.analyzedInstructions.length > 0 && data.analyzedInstructions[0].steps) {
                data.analyzedInstructions[0].steps.forEach(step => instructions.push(step.step));
            } else if (data.instructions) { instructions = data.instructions.split(/<ol>|<\/ol>|<li>|<\/li>|\n/).filter(step => step.trim() !== '' && !step.trim().startsWith('<')); }
            if (instructions.length > 0) { instructions.forEach(stepText => { const cleanedStep = stepText.replace(/<[^>]+>/g, '').trim(); if (cleanedStep) { const li = document.createElement('li'); li.textContent = cleanedStep; instructionsList.appendChild(li); } }); }
            else { instructionsList.innerHTML = '<li>No instructions provided.</li>'; }

            // Populate Nutrition
            const nutritionContainer = document.getElementById('nutrition-details'); nutritionContainer.innerHTML = ''; const nutritionSection = document.getElementById('recipe-nutrition');
            if (data.nutrition && data.nutrition.nutrients && data.nutrition.nutrients.length > 0) {
                const nutrientsToShow = ['Calories', 'Fat', 'Saturated Fat', 'Carbohydrates', 'Sugar', 'Protein', 'Sodium']; const nutrients = data.nutrition.nutrients; let nutritionHtml = '<ul>'; let found = 0;
                nutrientsToShow.forEach(name => { const n = nutrients.find(nut => nut.name === name); if (n) { nutritionHtml += `<li><strong>${n.name}:</strong> ${n.amount.toFixed(1)}${n.unit}</li>`; found++; } });
                nutritionHtml += '</ul>';
                if(found > 0){ nutritionContainer.innerHTML = nutritionHtml; nutritionSection.style.display = 'block'; } else { nutritionSection.style.display = 'none'; }
            } else { nutritionSection.style.display = 'none'; }

            document.title = `${data.title || 'Recipe'} Details`;
        })
        .catch(error => {
            showError(error); // Pass the whole error object
        });

    // --- Print Button Event Listener ---
    printButton.addEventListener('click', () => { window.print(); });

    // --- Scroll-to-Top Functionality ---
    function handleScroll() {
        if (window.scrollY > 300) { scrollToTopBtn.hidden = false; }
        else { scrollToTopBtn.hidden = true; }
    }
    function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    window.addEventListener('scroll', handleScroll);
    scrollToTopBtn.addEventListener('click', scrollToTop);

});
