// server.js (Backend API Proxy with Caching, Autocomplete, and Static File Serving Option)

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // Using node-fetch v2
const cors = require('cors');
const cache = require('memory-cache'); // Caching library
const path = require('path'); // Needed for serving static files

const app = express();
const PORT = process.env.PORT || 3000;
const apiKey = process.env.SPOONACULAR_API_KEY;

if (!apiKey) {
    console.error("FATAL ERROR: SPOONACULAR_API_KEY not found in .env file!");
    process.exit(1);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Helper Function for Spoonacular API Calls with Caching ---
async function makeSpoonacularRequest(apiUrl, cacheDurationMinutes = 10) { // Default cache 10 mins
    const cacheKey = `spoonacular_${apiUrl}`; // Simple cache key based on URL
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        console.log(`Cache HIT for: ${cacheKey.replace(apiKey, '***HIDDEN***')}`);
        return cachedData; // Return cached data
    } else {
        console.log(`Cache MISS for: ${cacheKey.replace(apiKey, '***HIDDEN***')}`);
    }

    console.log(`Fetching from Spoonacular: ${apiUrl.replace(apiKey, '***HIDDEN***')}`);
    try {
        const response = await fetch(apiUrl);
        // Try parsing JSON first in case of API error messages in JSON format
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            // If response is not JSON (e.g., plain text error or empty)
            if (!response.ok) {
                 // If status is bad and not JSON, throw a generic error
                 const error = new Error(`Spoonacular API Error: ${response.status} ${response.statusText}`);
                 error.status = response.status;
                 throw error;
            }
            // If status is ok but not JSON (unlikely for Spoonacular), handle as needed
             data = {}; // Or throw an error, depending on expectations
        }


        if (!response.ok) {
            console.error(`Spoonacular API Error: ${response.status} ${response.statusText}`);
            console.error("Spoonacular Response Body:", data);
            // Use the message from Spoonacular's response if available
            const errorMessage = data?.message || `Spoonacular error ${response.status}`;
            const error = new Error(errorMessage);
            error.status = response.status; // Attach status code to error object
            throw error;
        }

        // Cache the successful response only if duration > 0
        const cacheDurationMs = cacheDurationMinutes * 60 * 1000;
        if (cacheDurationMs > 0) {
             cache.put(cacheKey, data, cacheDurationMs);
             console.log(`Cached response for ${cacheDurationMinutes} mins.`);
        }

        return data; // Return successful data

    } catch (error) {
        // Catch fetch errors (network issues) or errors thrown above
        console.error("Error during Spoonacular fetch:", error);
        // Re-throw the error to be caught by the route handler
        throw error;
    }
}

// ==============================================================================
// Option B: Serve Static Frontend Files from Node.js (If NOT using separate Static Site hosting)
// If you deployed frontend separately on Render (Option A), you can COMMENT OUT or DELETE this section.
// ------------------------------------------------------------------------------
const frontendPath = path.join(__dirname, '.'); // Assumes HTML/CSS/JS are in the project root
console.log(`Serving static files from: ${frontendPath}`);
app.use(express.static(frontendPath));
// ==============================================================================


// --- API Routes ---

// Endpoint for Complex Recipe Search (Handles Sort, Pagination)
app.get('/api/recipes', async (req, res) => { // <-- RESTORED FUNCTION BODY
    try {
        const baseUrl = 'https://api.spoonacular.com/recipes/complexSearch';
        const params = new URLSearchParams({
            apiKey: apiKey,
            addRecipeInformation: true,
            fillIngredients: true, // Often useful with recipe info
        });

        // Allowed parameters from frontend + Pagination/Sorting
        const allowedParams = [
            'query', 'includeIngredients', 'excludeIngredients', 'cuisine', 'diet',
            'type', 'maxReadyTime', 'intolerances',
            'sort', 'sortDirection', 'offset', 'number' // Added sort/pagination params
        ];

        allowedParams.forEach(key => {
            if (req.query[key]) {
                params.append(key, req.query[key]);
            }
        });

        // Ensure 'number' has a default if not provided
        if (!params.has('number')) {
            params.append('number', '12'); // Default results per page
        }

        const spoonacularUrl = `${baseUrl}?${params.toString()}`;
        // Use a shorter cache for search results maybe? e.g., 5 minutes
        const recipeData = await makeSpoonacularRequest(spoonacularUrl, 5);

        // Important: Send back the full object including totalResults for pagination
        res.json(recipeData);

    } catch (error) {
        console.error("Error in /api/recipes route:", error.message);
        // Send back the status code from the Spoonacular error if available
        res.status(error.status || 500).json({ error: error.message || 'An unexpected error occurred on the server searching recipes.' });
    }
});

// Endpoint for Getting Recipe Details by ID (Cached)
app.get('/api/recipe/:id', async (req, res) => { // <-- RESTORED FUNCTION BODY
    const recipeId = req.params.id;

    if (!recipeId || isNaN(parseInt(recipeId))) { // Basic ID validation
         return res.status(400).json({ error: 'Valid Recipe ID parameter is required' });
    }

    try {
        const baseUrl = `https://api.spoonacular.com/recipes/${recipeId}/information`;
        const params = new URLSearchParams({
             apiKey: apiKey,
             includeNutrition: true // Get nutrition details
        });

        const spoonacularUrl = `${baseUrl}?${params.toString()}`;
        // Cache details longer, e.g., 30 minutes
        const recipeDetails = await makeSpoonacularRequest(spoonacularUrl, 30);
        res.json(recipeDetails); // Send the full recipe details object back

    } catch (error) {
        console.error(`Error in /api/recipe/${recipeId} route:`, error.message);
        res.status(error.status || 500).json({ error: error.message || 'An unexpected error occurred on the server fetching recipe details.' });
    }
});

// Endpoint for Ingredient Autocomplete
app.get('/api/ingredient-autocomplete', async (req, res) => { // <-- RESTORED FUNCTION BODY
    const query = req.query.query;
    const number = req.query.number || 5; // Limit suggestions

    if (!query) {
        return res.status(400).json({ error: 'Autocomplete query parameter is required' });
    }

    try {
        const baseUrl = 'https://api.spoonacular.com/food/ingredients/autocomplete';
        const params = new URLSearchParams({
            apiKey: apiKey,
            query: query,
            number: number
        });
        const spoonacularUrl = `${baseUrl}?${params.toString()}`;

        // Don't cache autocomplete heavily, or use very short duration (e.g., 1 min)
        const suggestions = await makeSpoonacularRequest(spoonacularUrl, 1);
        res.json(suggestions);

    } catch (error) {
        console.error("Error in /api/ingredient-autocomplete route:", error.message);
         res.status(error.status || 500).json({ error: error.message || 'An unexpected error occurred fetching autocomplete suggestions.' });
    }
});


// ==============================================================================
// Option B: Catch-all for Frontend Routes (If NOT using separate Static Site hosting)
// If you deployed frontend separately (Option A), COMMENT OUT or DELETE this section.
// This serves index.html for any non-API request, supporting client-side routing if needed.
// IMPORTANT: Place this AFTER all your API routes.
// ------------------------------------------------------------------------------
app.get('*', (req, res, next) => { // Added next parameter
    // Check if the request looks like an API call first
    if (req.path.startsWith('/api/')) {
        // If it starts with /api/ but wasn't caught, let a later error handler deal with it, or send 404 now
         // console.log(`API endpoint not found: ${req.path}`);
         // res.status(404).json({ error: 'API endpoint not found' });
         // OR better, just pass control
         return next();
    }
    // Otherwise, assume it's a frontend route and serve index.html
    const indexPath = path.join(frontendPath, 'index.html');
     console.log(`Serving index.html for path: ${req.path}`);
     res.sendFile(indexPath, (err) => {
         if (err) {
             console.error("Error sending index.html:", err);
             // Avoid sending another response if headers might be sent
             if (!res.headersSent) {
                 res.status(500).send("Error loading page.");
             }
         }
     });
});
// ==============================================================================


// --- Start the Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT} or assigned Render port`);
    console.log('Make sure your .env file contains your SPOONACULAR_API_KEY');
});
