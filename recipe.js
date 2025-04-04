// recipe.js - Handles fetching and displaying recipe details

document.addEventListener('DOMContentLoaded', () => {
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const errorText = errorMessage.querySelector('p');
    const recipeContent = document.getElementById('recipe-content');

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
    const backendDetailUrl = `http://localhost:3000/api/recipe/${recipeId}`;

    fetch(backendDetailUrl)
        .then(response => {
            if (!response.ok) {
                 // Try to get error message from backend JSON response
                 return response.json().then(errData => {
                     throw new Error(errData.error || `Server responded with status ${response.status}`);
                 }).catch(() => {
                     // Fallback if parsing backend error fails
                     throw new Error(`Failed to fetch details. Server responded with status ${response.status}`);
                 });
            }
            return response.json();
        })
        .then(data => {
            // Hide loading, show content
            loadingMessage.style.display = 'none';
            recipeContent.style.display = 'block';

            // Basic Info
            document.getElementById('recipe-title').textContent = data.title || 'N/A';
            document.getElementById('recipe-image').src = data.image || 'placeholder.jpg';
            document.getElementById('recipe-image').alt = data.title || 'Recipe image';

            // Meta Info
            document.getElementById('recipe-servings').innerHTML = `${data.servings ? data.servings : '-'}`; // Just the number
            document.getElementById('recipe-time').innerHTML = `${data.readyInMinutes ? data.readyInMinutes : '-'} min`; // Just the number + unit
            const sourceLink = document.getElementById('recipe-source').querySelector('a');
            if(data.sourceUrl) {
               sourceLink.href = data.sourceUrl;
               sourceLink.textContent = data.sourceName || data.creditsText || new URL(data.sourceUrl).hostname; // Use hostname as fallback text
               document.getElementById('recipe-source').style.display = 'inline-flex'; // Show span if link exists
            } else {
                // If no URL, hide the whole source span
                document.getElementById('recipe-source').style.display = 'none';
            }


            // Summary (potentially contains HTML)
            const summaryElement = document.getElementById('recipe-summary');
            const summaryContent = document.getElementById('summary-content');
             if(data.summary) {
                summaryContent.innerHTML = data.summary; // Use innerHTML carefully as it comes from API
                summaryElement.style.display = 'block'; // Show section
             } else {
                summaryElement.style.display = 'none'; // Hide section if no summary
             }


            // Ingredients
            const ingredientsList = document.getElementById('recipe-ingredients');
            ingredientsList.innerHTML = ''; // Clear previous
            if (data.extendedIngredients && data.extendedIngredients.length > 0) {
                data.extendedIngredients.forEach(ingredient => {
                    const li = document.createElement('li');
                    li.textContent = ingredient.original; // e.g., "1 cup flour"
                    ingredientsList.appendChild(li);
                });
            } else {
                 ingredientsList.innerHTML = '<li>No ingredients listed.</li>';
            }

             // Instructions
            const instructionsList = document.getElementById('recipe-instructions');
            instructionsList.innerHTML = ''; // Clear previous
            let instructions = [];
            if(data.analyzedInstructions && data.analyzedInstructions.length > 0 && data.analyzedInstructions[0].steps) {
                // Prefer analyzed instructions if available and structured correctly
                data.analyzedInstructions[0].steps.forEach(step => {
                    instructions.push(step.step);
                });
            } else if (data.instructions) {
                // Fallback to raw instructions string (less reliable formatting)
                 instructions = data.instructions.split(/<ol>|<\/ol>|<li>|<\/li>|\n/); // Attempt to split common tags/newlines
                 instructions = instructions.filter(step => step.trim() !== '' && !step.trim().startsWith('<')); // Filter empty and tag-only lines
            }

             if (instructions.length > 0) {
                 instructions.forEach(stepText => {
                    const cleanedStep = stepText.replace(/<[^>]+>/g, '').trim(); // Remove any remaining HTML tags
                    if (cleanedStep) { // Avoid empty steps after cleaning
                        const li = document.createElement('li');
                        li.textContent = cleanedStep;
                        instructionsList.appendChild(li);
                    }
                 });
             } else {
                 instructionsList.innerHTML = '<li>No instructions provided.</li>';
             }


            // Nutrition
            const nutritionContainer = document.getElementById('nutrition-details');
            nutritionContainer.innerHTML = ''; // Clear previous
            const nutritionSection = document.getElementById('recipe-nutrition');
            if (data.nutrition && data.nutrition.nutrients && data.nutrition.nutrients.length > 0) {
                const nutrientsToShow = ['Calories', 'Fat', 'Saturated Fat', 'Carbohydrates', 'Sugar', 'Protein', 'Sodium']; // Customize as needed
                const nutrients = data.nutrition.nutrients;
                let nutritionHtml = '<ul>';
                let foundNutrientsCount = 0;
                nutrientsToShow.forEach(name => {
                    const nutrient = nutrients.find(n => n.name === name);
                    if (nutrient) {
                        nutritionHtml += `<li><strong>${nutrient.name}:</strong> ${nutrient.amount.toFixed(1)}${nutrient.unit}</li>`; // Format amount
                        foundNutrientsCount++;
                    }
                });
                 nutritionHtml += '</ul>';

                 if(foundNutrientsCount > 0){ // Only add if we found some relevant nutrients
                    nutritionContainer.innerHTML = nutritionHtml;
                    nutritionSection.style.display = 'block'; // Show the section
                 } else {
                    nutritionSection.style.display = 'none'; // Hide if no relevant nutrients found
                 }

            } else {
                 nutritionSection.style.display = 'none'; // Hide section if no nutrition data at all
            }

            // Update page title
            document.title = `${data.title || 'Recipe'} Details`;

        })
        .catch(error => {
            showError(error.message);
            document.title = "Error Loading Recipe"; // Update title on error
        });
});