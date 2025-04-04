// server.js (Updated)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // Using node-fetch v2
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const apiKey = process.env.SPOONACULAR_API_KEY; // Get API key once

if (!apiKey) {
    console.error("FATAL ERROR: SPOONACULAR_API_KEY not found in .env file!");
    process.exit(1); // Stop the server if key is missing
}

app.use(cors());
app.use(express.json());

// --- Endpoint for Complex Recipe Search ---
app.get('/api/recipes', async (req, res) => {
    try {
        // Base URL for complex search
        let spoonacularUrl = `https://api.spoonacular.com/recipes/complexSearch?apiKey=${apiKey}&number=12&addRecipeInformation=true`;

        // Extract query parameters from request
        const { query, includeIngredients, excludeIngredients, cuisine, diet, type, maxReadyTime, intolerances } = req.query;

        // Append parameters to URL if they exist
        if (query) spoonacularUrl += `&query=${encodeURIComponent(query)}`;
        if (includeIngredients) spoonacularUrl += `&includeIngredients=${encodeURIComponent(includeIngredients)}`;
        if (excludeIngredients) spoonacularUrl += `&excludeIngredients=${encodeURIComponent(excludeIngredients)}`;
        if (cuisine) spoonacularUrl += `&cuisine=${encodeURIComponent(cuisine)}`;
        if (diet) spoonacularUrl += `&diet=${encodeURIComponent(diet)}`;
        if (type) spoonacularUrl += `&type=${encodeURIComponent(type)}`;
        if (maxReadyTime) spoonacularUrl += `&maxReadyTime=${encodeURIComponent(maxReadyTime)}`;
        if (intolerances) spoonacularUrl += `&intolerances=${encodeURIComponent(intolerances)}`; // Expecting comma-separated string

        console.log(`Fetching from Spoonacular (Search): ${spoonacularUrl.replace(apiKey, '***HIDDEN***')}`);

        const apiResponse = await fetch(spoonacularUrl);

        if (!apiResponse.ok) {
            console.error(`Spoonacular API Search Error: ${apiResponse.status} ${apiResponse.statusText}`);
             try { // Try to parse error details from Spoonacular
                 const errorBody = await apiResponse.json();
                 console.error("Spoonacular Error Body:", errorBody);
                 return res.status(apiResponse.status).json({ error: errorBody.message || `Spoonacular error ${apiResponse.status}` });
             } catch (parseError) {
                 // If parsing fails, send generic error
                 return res.status(apiResponse.status).json({ error: `Failed to fetch recipes from Spoonacular. Status: ${apiResponse.status}` });
             }
        }

        const recipeData = await apiResponse.json();
        res.json(recipeData); // Send { results: [...] } back to frontend

    } catch (error) {
        console.error("Error in /api/recipes route:", error);
        res.status(500).json({ error: 'An unexpected error occurred on the server searching recipes.' });
    }
});

// --- NEW Endpoint for Getting Recipe Details by ID ---
app.get('/api/recipe/:id', async (req, res) => {
    const recipeId = req.params.id; // Get ID from URL path parameter

    if (!recipeId) {
         return res.status(400).json({ error: 'Recipe ID parameter is required' });
    }

    try {
         // Include nutrition info in the details request
        const spoonacularUrl = `https://api.spoonacular.com/recipes/${recipeId}/information?includeNutrition=true&apiKey=${apiKey}`;

        console.log(`Fetching from Spoonacular (Details): ${spoonacularUrl.replace(apiKey, '***HIDDEN***')}`);

        const apiResponse = await fetch(spoonacularUrl);

        if (!apiResponse.ok) {
            console.error(`Spoonacular API Details Error: ${apiResponse.status} ${apiResponse.statusText}`);
            try {
                const errorBody = await apiResponse.json();
                console.error("Spoonacular Error Body:", errorBody);
                return res.status(apiResponse.status).json({ error: errorBody.message || `Spoonacular error ${apiResponse.status}` });
            } catch (parseError) {
                return res.status(apiResponse.status).json({ error: `Failed to fetch recipe details from Spoonacular. Status: ${apiResponse.status}` });
            }
        }

        const recipeDetails = await apiResponse.json();
        res.json(recipeDetails); // Send the full recipe details object back

    } catch (error) {
        console.error(`Error in /api/recipe/${recipeId} route:`, error);
        res.status(500).json({ error: 'An unexpected error occurred on the server fetching recipe details.' });
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});