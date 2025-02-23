import React, { useState } from "react";
import axios from "axios";

interface RecordType {
  canonicalName: string;
  variations: string[];
  category: string;
}

const Search: React.FC = () => {
  const [query, setQuery] = useState("");
  const [record, setRecord] = useState<RecordType | null>(null);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    setError("");
    try {
      const response = await axios.get(`http://localhost:3000/api/search?query=${encodeURIComponent(query)}`);
      console.log(encodeURIComponent(query)) ; 
      setRecord(response.data);
    } catch (err) {
      setError("Error occurred during search.");
    }
  };

  return (
    <div>
      <h1>Search System</h1>
      <input
        type="text"
        value={query}
        placeholder="Enter search query..."
        onChange={(e) => setQuery(e.target.value)}
      />
      <button onClick={handleSearch}>Search</button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {record && (
        <div>
          <h2>Canonical Record</h2>
          <p><strong>Name:</strong> {record.canonicalName}</p>
          <p><strong>Category:</strong> {record.category}</p>
          <p><strong>Variations:</strong> {record.variations.join(", ")}</p>
        </div>
      )}
    </div>
  );
};

export default Search;
