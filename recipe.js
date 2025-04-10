// recipe.js - Handles fetching and displaying recipe details, print, checklist, scroll-to-top, share

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loadingMessage = document.getElementById('loading-message');
    const errorMessage = document.getElementById('error-message');
    const errorText = errorMessage.querySelector('p');
    const recipeContent = document.getElementById('recipe-content');
    const printButton = document.getElementById('printRecipeButton');
    const ingredientsList = document.getElementById('recipe-ingredients');
    const scrollToTopBtn = document.getElementById('scrollToTopBtn');
    const shareButton = document.getElementById('shareRecipeButton'); // NEW
    const statusMessage = document.getElementById('statusMessage'); // NEW

    // --- State ---
    let recipeTitle = 'Recipe'; // Default title
    let recipeUrl = window.location.href; // Current URL

    // --- Utility Functions ---
    function announceStatus(message) { // For screen reader announcements
        if (statusMessage) {
            statusMessage.textContent = message;
            // Clear after a short delay
            setTimeout(() => { statusMessage.textContent = ''; }, 3000);
        }
    }

    // Function to display errors (Enhanced)
    function showError(error) { /* ... (keep improved error logic from previous script.js) ... */
        console.error("Error fetching recipe details:", error); loadingMessage.style.display = 'none'; recipeContent.style.display = 'none'; let userMessage = `😕 Sorry, couldn't load recipe details. An unexpected error occurred.`;
        if (error.message) { const lowerCaseError = error.message.toLowerCase(); if (lowerCaseError.includes('quota') || lowerCaseError.includes('limit') || error.status === 402) { userMessage = "📋 Sorry, the daily recipe lookup limit has been reached. Please try again tomorrow!"; } else if (lowerCaseError.includes('api key') || error.status === 401 || error.status === 403) { userMessage = "🔑 Oops! There seems to be an issue accessing the recipe data."; } else if (error.status === 404) { userMessage = "❓ Recipe not found. It might have been removed or the link is incorrect."; } else { userMessage = `😕 Sorry, couldn't load recipe details. Error: ${error.message}.`; } }
        errorText.textContent = userMessage; errorMessage.style.display = 'block'; document.title = "Error Loading Recipe"; announceStatus(userMessage); // Announce error
    }

    // Get recipe ID from URL query parameter
    const params = new URLSearchParams(window.location.search);
    const recipeId = params.get('id');

    if (!recipeId) { showError({ message: 'No recipe ID provided in the URL.' }); return; }

    // --- API Configuration ---
    // !!! IMPORTANT: Replace with YOUR deployed backend URL !!!
    const backendBaseUrl = 'https://azealle-recipe-finder.onrender.com/api'; // e.g., 'https://my-recipe-backend.onrender.com/api'
    // !!! Make sure it's HTTPS !!!
    const backendDetailUrl = `${backendBaseUrl}/recipe/${recipeId}`;

    // --- Fetch and Populate ---
    fetch(backendDetailUrl)
        .then(response => { /* ... (keep fetch logic as before) ... */
            if (!response.ok) {
                 return response.json().then(errData => { const e = new Error(errData.error || `Server responded with status ${response.status}`); e.status = response.status; throw e; })
                 .catch(() => { const e = new Error(`Failed to fetch details. Server responded with status ${response.status}`); e.status = response.status; throw e; });
            } return response.json();
        })
        .then(data => {
            loadingMessage.style.display = 'none'; recipeContent.style.display = 'block';

            recipeTitle = data.title || 'Recipe'; // Store title for sharing
            document.title = `${recipeTitle} Details`; // Update page title

            // Populate Basic Info, Meta (with tooltips)
            document.getElementById('recipe-title').textContent = recipeTitle;
            document.getElementById('recipe-image').src = data.image || 'placeholder.jpg';
            document.getElementById('recipe-image').alt = recipeTitle; // Use actual title for alt text
            document.getElementById('recipe-servings').innerHTML = `<span title="Servings">👥</span> ${data.servings ? data.servings : '-'}`;
            document.getElementById('recipe-time').innerHTML = `<span title="Ready in Minutes">⏰</span> ${data.readyInMinutes ? data.readyInMinutes : '-'} min`;
            const sourceLink = document.getElementById('recipe-source').querySelector('a'); const sourceSpan = document.getElementById('recipe-source');
            if(data.sourceUrl) { sourceLink.href = data.sourceUrl; sourceLink.textContent = data.sourceName || data.creditsText || new URL(data.sourceUrl).hostname; sourceSpan.style.display = 'inline-flex'; sourceSpan.title = `Source: ${sourceLink.textContent}`; }
            else { sourceSpan.style.display = 'none'; }

            // Populate Summary
            const summaryElement = document.getElementById('recipe-summary'); const summaryContent = document.getElementById('summary-content');
             if(data.summary) { summaryContent.innerHTML = data.summary; summaryElement.style.display = 'block'; } else { summaryElement.style.display = 'none'; }

            // Populate Ingredients (Checklist)
            ingredientsList.innerHTML = '';
            if (data.extendedIngredients && data.extendedIngredients.length > 0) {
                data.extendedIngredients.forEach(ingredient => {
                    const li = document.createElement('li');
                    li.setAttribute('role', 'checkbox'); // ARIA role
                    li.setAttribute('aria-checked', 'false'); // Initial state
                    li.tabIndex = 0; li.title = `Check/uncheck ${ingredient.nameClean || ingredient.name}`;
                    // Add span for the text content for better styling/selection if needed
                    const textSpan = document.createElement('span');
                    textSpan.textContent = ingredient.original;
                    li.appendChild(textSpan);

                    const toggleCheck = () => {
                        const isChecked = li.classList.toggle('checked');
                        li.setAttribute('aria-checked', isChecked); // Update ARIA state
                    };
                    li.addEventListener('click', toggleCheck);
                    li.addEventListener('keypress', (e) => { if (e.key === 'Enter' || e.key === ' ') { toggleCheck(); e.preventDefault(); } });
                    ingredientsList.appendChild(li);
                });
            } else { ingredientsList.innerHTML = '<li>No ingredients listed.</li>'; }

            // Populate Instructions
            const instructionsList = document.getElementById('recipe-instructions'); instructionsList.innerHTML = ''; let instructions = [];
            if(data.analyzedInstructions?.[0]?.steps) { data.analyzedInstructions[0].steps.forEach(step => instructions.push(step.step)); }
            else if (data.instructions) { instructions = data.instructions.split(/<ol>|<\/ol>|<li>|<\/li>|\n/).filter(step => step.trim() !== '' && !step.trim().startsWith('<')); }
            if (instructions.length > 0) { instructions.forEach(stepText => { const cleanedStep = stepText.replace(/<[^>]+>/g, '').trim(); if (cleanedStep) { const li = document.createElement('li'); li.textContent = cleanedStep; instructionsList.appendChild(li); } }); }
            else { instructionsList.innerHTML = '<li>No instructions provided.</li>'; }

            // Populate Nutrition
            const nutritionContainer = document.getElementById('nutrition-details'); nutritionContainer.innerHTML = ''; const nutritionSection = document.getElementById('recipe-nutrition');
            if (data.nutrition?.nutrients?.length > 0) {
                const nutrientsToShow = ['Calories', 'Fat', 'Saturated Fat', 'Carbohydrates', 'Sugar', 'Protein', 'Sodium']; const nutrients = data.nutrition.nutrients; let nutritionHtml = '<ul>'; let found = 0;
                nutrientsToShow.forEach(name => { const n = nutrients.find(nut => nut.name === name); if (n) { nutritionHtml += `<li><strong>${n.name}:</strong> ${n.amount.toFixed(1)}${n.unit}</li>`; found++; } }); nutritionHtml += '</ul>';
                if(found > 0){ nutritionContainer.innerHTML = nutritionHtml; nutritionSection.style.display = 'block'; } else { nutritionSection.style.display = 'none'; }
            } else { nutritionSection.style.display = 'none'; }

            announceStatus(`${recipeTitle} details loaded.`); // Announce successful load

        })
        .catch(error => { showError(error); });

    // --- Share Functionality ---
    async function shareRecipe() {
        const shareData = {
            title: recipeTitle,
            text: `Check out this recipe for ${recipeTitle}!`,
            url: recipeUrl
        };

        if (navigator.share) { // Use Web Share API if available
            try {
                await navigator.share(shareData);
                console.log('Recipe shared successfully');
                announceStatus('Recipe shared.');
            } catch (err) {
                console.error('Share failed:', err.message);
                // Don't show fallback if user cancelled share dialog
                if (err.name !== 'AbortError') {
                     copyUrlFallback(); // Use fallback if share fails for other reasons
                }
            }
        } else {
            // Fallback: Copy URL to clipboard
            copyUrlFallback();
        }
    }

    function copyUrlFallback() {
        navigator.clipboard.writeText(recipeUrl).then(() => {
            console.log('Recipe URL copied to clipboard');
            announceStatus('Recipe link copied to clipboard.');
            // Optional: Visual feedback on the button
            const originalText = shareButton.innerHTML;
            shareButton.innerHTML = `<span aria-hidden="true">✅</span> Copied!`;
            shareButton.disabled = true;
            setTimeout(() => {
                shareButton.innerHTML = originalText;
                 shareButton.disabled = false;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy URL: ', err);
             announceStatus('Failed to copy link.');
             // You could show an alert or message to the user here
             alert('Failed to copy link. Please copy the URL from your browser bar.');
        });
    }


    // --- Event Listeners ---
    printButton.addEventListener('click', () => { window.print(); });
    shareButton.addEventListener('click', shareRecipe); // NEW

    // --- Scroll-to-Top ---
    function handleScroll() { /* ... (keep as before) ... */
        if (!scrollToTopBtn) return; if (window.scrollY > 300) { scrollToTopBtn.hidden = false; } else { scrollToTopBtn.hidden = true; }
    }
    function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    window.addEventListener('scroll', handleScroll);
    scrollToTopBtn.addEventListener('click', scrollToTop);

});
