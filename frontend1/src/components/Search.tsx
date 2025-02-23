import React, { useState } from "react";
import axios from "axios";
import "./Search.css"; // Import the CSS file

interface SearchResult {
  canonicalName: string;
  variations: string[];
  category?: string;
}

const SearchComponent: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.get<SearchResult>(
        `http://localhost:3000/api/search?query=${encodeURIComponent(query)}`
      );
      setResult(response.data);
    } catch (err) {
      setError("❌ Failed to fetch results. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>🔎 Entity Normalization Search</h1>
      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter a term..."
          className="search-input"
        />
        <button onClick={handleSearch} disabled={loading} className="search-button">
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {result && (
        <div className="result-box">
          <h2>📌 Canonical Name: <span>{result.canonicalName}</span></h2>
          {result.category && <h3>📂 Category: <span>{result.category}</span></h3>}
          <h3>🔀 Variations:</h3>
          <ul>
            {result.variations.map((variation, index) => (
              <li key={index}>{variation}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchComponent;
