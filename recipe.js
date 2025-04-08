// recipe.js - Handles fetching and displaying recipe details, print, checklist

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const errorText = errorMessage.querySelector('p');
    const recipeContent = document.getElementById('recipe-content');
    const printButton = document.getElementById('printRecipeButton'); // NEW: Print button
    const ingredientsList = document.getElementById('recipe-ingredients'); // NEW: Ingredient list ref

    // Function to display errors
    function showError(message) {
        loadingMessage.style.display = 'none';
        recipeContent.style.display = 'none';
        errorText.textContent = `Error: ${message}. Please try going back or searching again.`;
        errorMessage.style.display = 'block';
        console.error(message);
    }

    // Get recipe ID from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');

    if (!recipeId) {
        showError('No recipe ID provided in the URL.');
        return;
    }

    // Fetch recipe details from the backend
    // Use the same base URL as script.js for consistency
    const backendBaseUrl = 'http://localhost:3000/api';
    const backendDetailUrl = `${backendBaseUrl}/recipe/${recipeId}`;

    fetch(backendDetailUrl)
        .then(response => {
            if (!response.ok) {
                 return response.json().then(errData => {
                     throw new Error(errData.error || `Server responded with status ${response.status}`);
                 }).catch(() => {
                     throw new Error(`Failed to fetch details. Server responded with status ${response.status}`);
                 });
            }
            return response.json();
        })
        .then(data => {
            // Hide loading, show content
            loadingMessage.style.display = 'none';
            recipeContent.style.display = 'block';

            // --- Populate the page (Keep most of this the same) ---
            document.getElementById('recipe-title').textContent = data.title || 'N/A';
            document.getElementById('recipe-image').src = data.image || 'placeholder.jpg';
            document.getElementById('recipe-image').alt = data.title || 'Recipe image';
            document.getElementById('recipe-servings').innerHTML = `${data.servings ? data.servings : '-'}`;
            document.getElementById('recipe-time').innerHTML = `${data.readyInMinutes ? data.readyInMinutes : '-'} min`;
            const sourceLink = document.getElementById('recipe-source').querySelector('a');
            const sourceSpan = document.getElementById('recipe-source');
            if(data.sourceUrl) {
               sourceLink.href = data.sourceUrl;
               sourceLink.textContent = data.sourceName || data.creditsText || new URL(data.sourceUrl).hostname;
               sourceSpan.style.display = 'inline-flex';
            } else {
                sourceSpan.style.display = 'none';
            }

            const summaryElement = document.getElementById('recipe-summary');
            const summaryContent = document.getElementById('summary-content');
             if(data.summary) {
                summaryContent.innerHTML = data.summary;
                summaryElement.style.display = 'block';
             } else {
                summaryElement.style.display = 'none';
             }

            // --- Ingredients (Modified for Checklist) ---
            ingredientsList.innerHTML = ''; // Clear previous
            if (data.extendedIngredients && data.extendedIngredients.length > 0) {
                data.extendedIngredients.forEach(ingredient => {
                    const li = document.createElement('li');
                    li.textContent = ingredient.original; // Display text
                    li.tabIndex = 0; // Make focusable for keyboard interaction
                    // Add click listener for checklist functionality
                    li.addEventListener('click', () => {
                        li.classList.toggle('checked');
                    });
                    // Add keypress listener (Enter/Space) for accessibility
                     li.addEventListener('keypress', (event) => {
                         if (event.key === 'Enter' || event.key === ' ') {
                             li.classList.toggle('checked');
                             event.preventDefault(); // Prevent default space scroll
                         }
                     });
                    ingredientsList.appendChild(li);
                });
            } else {
                 ingredientsList.innerHTML = '<li>No ingredients listed.</li>';
            }

             // --- Instructions (Keep the same logic) ---
            const instructionsList = document.getElementById('recipe-instructions');
            instructionsList.innerHTML = '';
            let instructions = [];
            if(data.analyzedInstructions && data.analyzedInstructions.length > 0 && data.analyzedInstructions[0].steps) {
                data.analyzedInstructions[0].steps.forEach(step => instructions.push(step.step));
            } else if (data.instructions) {
                 instructions = data.instructions.split(/<ol>|<\/ol>|<li>|<\/li>|\n/).filter(step => step.trim() !== '' && !step.trim().startsWith('<'));
            }
             if (instructions.length > 0) {
                 instructions.forEach(stepText => {
                    const cleanedStep = stepText.replace(/<[^>]+>/g, '').trim();
                    if (cleanedStep) { const li = document.createElement('li'); li.textContent = cleanedStep; instructionsList.appendChild(li); }
                 });
             } else { instructionsList.innerHTML = '<li>No instructions provided.</li>'; }


            // --- Nutrition (Keep the same logic) ---
            const nutritionContainer = document.getElementById('nutrition-details');
            nutritionContainer.innerHTML = '';
            const nutritionSection = document.getElementById('recipe-nutrition');
            if (data.nutrition && data.nutrition.nutrients && data.nutrition.nutrients.length > 0) {
                const nutrientsToShow = ['Calories', 'Fat', 'Saturated Fat', 'Carbohydrates', 'Sugar', 'Protein', 'Sodium'];
                const nutrients = data.nutrition.nutrients; let nutritionHtml = '<ul>'; let foundNutrientsCount = 0;
                nutrientsToShow.forEach(name => {
                    const nutrient = nutrients.find(n => n.name === name);
                    if (nutrient) { nutritionHtml += `<li><strong>${nutrient.name}:</strong> ${nutrient.amount.toFixed(1)}${nutrient.unit}</li>`; foundNutrientsCount++; }
                });
                 nutritionHtml += '</ul>';
                 if(foundNutrientsCount > 0){ nutritionContainer.innerHTML = nutritionHtml; nutritionSection.style.display = 'block'; }
                 else { nutritionSection.style.display = 'none'; }
            } else { nutritionSection.style.display = 'none'; }

            // Update page title
            document.title = `${data.title || 'Recipe'} Details`;

        })
        .catch(error => {
            showError(error.message);
            document.title = "Error Loading Recipe";
        });

    // --- NEW: Print Button Event Listener ---
    printButton.addEventListener('click', () => {
        window.print(); // Trigger browser's print dialog
    });

});