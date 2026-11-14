import React, { useEffect, useState } from "react";

const weatherIcon = code => {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌡️";
};

export function WeatherTemperature() {
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    let cancelled = false;
    let controller = null;
    const load = () => {
      navigator.geolocation.getCurrentPosition(async position => {
        if (cancelled) return;
        controller?.abort();
        controller = new AbortController();
        try {
          const { latitude, longitude } = position.coords;
          const params = new URLSearchParams({
            latitude: String(latitude),
            longitude: String(longitude),
            current: "temperature_2m,weather_code",
            timezone: "auto"
          });
          const response = await fetch("https://api.open-meteo.com/v1/forecast?" + params, { signal: controller.signal });
          if (!response.ok) throw new Error("Weather request failed");
          const json = await response.json();
          if (!Number.isFinite(json.current?.temperature_2m)) throw new Error("No temperature");
          if (!cancelled) {
            setWeather({ temperature: Math.round(json.current.temperature_2m), code: json.current.weather_code });
            setStatus("ready");
          }
        } catch (error) {
          if (!cancelled && error.name !== "AbortError") setStatus("unavailable");
        }
      }, () => { if (!cancelled) setStatus("unavailable"); }, {
        enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000
      });
    };
    load();
    const interval = window.setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(interval); controller?.abort(); };
  }, []);

  const ready = status === "ready" && weather;
  return (
    <span
      title={ready ? "현재 위치 기온 · 약 30분마다 갱신" : "위치 권한 또는 날씨 정보를 확인할 수 없음"}
      aria-label={ready ? `현재 기온 ${weather.temperature}도` : "현재 기온 확인 불가"}
      style={{display:"inline-flex",alignItems:"center",gap:3,flexShrink:0,whiteSpace:"nowrap",fontSize:12,fontWeight:650,color:"#725299",padding:"4px 5px"}}
    >
      <span aria-hidden="true">{ready ? weatherIcon(weather.code) : "🌡️"}</span>
      <span>{ready ? `${weather.temperature}°` : "—°"}</span>
    </span>
  );
}
