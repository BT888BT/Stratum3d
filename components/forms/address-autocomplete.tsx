"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type ParsedAddress = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

declare global {
  interface Window {
    google: typeof google;
    initGooglePlaces?: () => void;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.places) { resolve(); return; }
    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    window.initGooglePlaces = () => resolve();
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGooglePlaces`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

function parseComponents(
  components: google.maps.GeocoderAddressComponent[]
): ParsedAddress | null {
  const get = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? "";
  const getShort = (type: string) =>
    components.find((c) => c.types.includes(type))?.short_name ?? "";

  const country = getShort("country");
  if (country !== "AU") return null; // Australia only

  const streetNumber = get("street_number");
  const route = get("route");
  const subpremise = get("subpremise");

  const line1 = [streetNumber, route].filter(Boolean).join(" ");
  const line2 = subpremise || undefined;
  const city =
    get("locality") ||
    get("sublocality") ||
    get("administrative_area_level_2");
  const state = getShort("administrative_area_level_1");
  const postcode = get("postal_code");

  if (!line1 || !city || !state || !postcode) return null;

  return { line1, line2, city, state, postcode, country: "AU" };
}

interface Props {
  onSelect: (address: ParsedAddress) => void;
  error?: string;
}

export default function AddressAutocomplete({ onSelect, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [loadError, setLoadError] = useState("");
  const [verified, setVerified] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const initAutocomplete = useCallback(async () => {
    if (!apiKey || !inputRef.current) return;
    try {
      await loadGoogleMaps(apiKey);
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "au" },
        types: ["address"],
        fields: ["address_components", "formatted_address"],
      });

      autocompleteRef.current = ac;

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) {
          setLoadError("Could not verify that address. Please select from the dropdown.");
          setVerified(false);
          return;
        }

        const parsed = parseComponents(place.address_components);
        if (!parsed) {
          setLoadError("Only Australian addresses are accepted.");
          setVerified(false);
          return;
        }

        setInputValue(place.formatted_address ?? parsed.line1);
        setLoadError("");
        setVerified(true);
        onSelect(parsed);
      });
    } catch {
      setLoadError("Address autocomplete unavailable. Check your Google Maps API key.");
    }
  }, [apiKey, onSelect]);

  useEffect(() => {
    initAutocomplete();
  }, [initAutocomplete]);

  // If user manually edits after selecting, mark as unverified
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    setVerified(false);
  }

  const borderColor = loadError || error
    ? "var(--red)"
    : verified
    ? "rgba(0, 229, 160, 0.6)"
    : "var(--border)";

  const showError = loadError || error;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          placeholder="Start typing your address..."
          className="input-field"
          style={{
            borderColor,
            paddingRight: verified ? 36 : 14,
            transition: "border-color 0.2s",
          }}
          autoComplete="off"
        />
        {verified && (
          <span style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--green)",
            fontSize: 16,
            pointerEvents: "none",
          }}>✓</span>
        )}
      </div>

      {showError && (
        <span style={{ fontSize: 11, color: "var(--red)" }}>{showError}</span>
      )}

      {!apiKey && (
        <span style={{ fontSize: 11, color: "var(--amber)" }}>
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable address verification.
        </span>
      )}

      <span style={{ fontSize: 11, color: "var(--muted)" }}>
        Australian addresses only — select from the dropdown to verify.
      </span>
    </div>
  );
}
