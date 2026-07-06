const apiKey = import.meta.env.VITE_WEATHER_API_KEY
export const isWeatherConfigured = 
  !!apiKey && 
  apiKey !== 'your_openweather_api_key' && 
  apiKey.trim() !== '';

// Generates high-fidelity mock data for demo mode
export const getMockWeatherData = (city = 'Saudi Arabia') => {
  const cleanCity = city.trim().toLowerCase()
  let condition = 'clear'
  let temp = 32
  let desc = 'clear sky'
  let humidity = 20
  let windSpeed = 3.5

  if (cleanCity.includes('london')) {
    condition = 'rain'
    temp = 13
    desc = 'moderate rain'
    humidity = 85
    windSpeed = 5.2
  } else if (cleanCity.includes('tokyo')) {
    condition = 'clouds'
    temp = 21
    desc = 'broken clouds'
    humidity = 60
    windSpeed = 2.1
  } else if (cleanCity.includes('moscow') || cleanCity.includes('oslo') || cleanCity.includes('snow') || cleanCity.includes('canada')) {
    condition = 'snow'
    temp = -3
    desc = 'light snow'
    humidity = 90
    windSpeed = 4.0
  } else if (cleanCity.includes('dubai')) {
    condition = 'clear'
    temp = 39
    desc = 'sunny and hot'
    humidity = 15
    windSpeed = 4.8
  } else if (cleanCity.includes('paris')) {
    condition = 'clouds'
    temp = 17
    desc = 'overcast clouds'
    humidity = 70
    windSpeed = 3.1
  }

  // Create 5-day forecast
  const forecast = []
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const startDayIdx = new Date().getDay()
  for (let i = 0; i < 5; i++) {
    const dayName = days[(startDayIdx + i) % 7]
    let fTemp = temp + Math.floor(Math.sin(i) * 3)
    let fCond = condition
    if (i === 2) fCond = 'clouds'
    if (i === 4 && condition === 'clear') fCond = 'clouds'
    forecast.push({
      day: dayName,
      temp: Math.round(fTemp),
      condition: fCond,
    })
  }

  // Create 24h temp trend
  const hourly = []
  const currentHour = new Date().getHours()
  for (let i = 0; i < 8; i++) {
    const hour = (currentHour + i * 3) % 24
    const timeStr = `${hour.toString().padStart(2, '0')}:00`
    hourly.push({
      time: timeStr,
      temp: Math.round(temp + Math.sin(i / 1.2) * 4)
    })
  }

  return {
    current: {
      name: city.toUpperCase(),
      temp: Math.round(temp),
      condition,
      description: desc,
      humidity,
      wind: windSpeed,
      aqi: Math.floor(Math.sin(cleanCity.length) * 2) + 2, // 1 to 4 scale
      sunrise: '05:22 AM',
      sunset: '06:54 PM',
      lat: 24.7136,
      lon: 46.6753,
    },
    forecast,
    hourly,
    isDemo: true
  }
}

// Main entry fetcher
export const fetchWeatherData = async (city) => {
  if (!isWeatherConfigured) {
    // Artificial load response time
    await new Promise(resolve => setTimeout(resolve, 500))
    return getMockWeatherData(city)
  }

  try {
    // 1. Fetch current weather
    const currentRes = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`
    )
    if (!currentRes.ok) throw new Error('City not found')
    const currentData = await currentRes.json()

    const lat = currentData.coord.lat
    const lon = currentData.coord.lon
    const name = currentData.name
    const temp = Math.round(currentData.main.temp)
    
    // Normalize weather conditions
    let condition = 'clear'
    const mainCondition = currentData.weather[0].main.toLowerCase()
    if (mainCondition.includes('cloud')) {
      condition = 'clouds'
    } else if (mainCondition.includes('rain') || mainCondition.includes('drizzle') || mainCondition.includes('thunderstorm')) {
      condition = 'rain'
    } else if (mainCondition.includes('snow')) {
      condition = 'snow'
    } else if (mainCondition.includes('clear')) {
      condition = 'clear'
    } else {
      condition = 'clouds' // fallback
    }

    const description = currentData.weather[0].description
    const humidity = currentData.main.humidity
    const wind = currentData.wind.speed
    
    // Format times
    const formatTime = (timestamp) => {
      return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    const sunrise = formatTime(currentData.sys.sunrise)
    const sunset = formatTime(currentData.sys.sunset)

    // 2. Fetch AQI
    let aqi = 1
    try {
      const aqiRes = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`
      )
      if (aqiRes.ok) {
        const aqiData = await aqiRes.json()
        aqi = aqiData.list[0].main.aqi
      }
    } catch (e) {
      console.warn('AQI lookup failed', e)
    }

    // 3. Fetch 5-day / 3-hour forecast
    const forecastRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
    )
    if (!forecastRes.ok) throw new Error('Forecast lookup failed')
    const forecastData = await forecastRes.json()

    const daysMap = {}
    const hourly = []
    
    forecastData.list.forEach((item, index) => {
      // 24hr hourly details (first 8 slices)
      if (index < 8) {
        const timeStr = new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        hourly.push({
          time: timeStr,
          temp: Math.round(item.main.temp)
        })
      }

      // Group forecast days
      const date = new Date(item.dt * 1000)
      const dayName = date.toLocaleDateString([], { weekday: 'short' })
      const hour = date.getHours()

      if (!daysMap[dayName] || Math.abs(hour - 12) < Math.abs(daysMap[dayName].hour - 12)) {
        let fCond = 'clear'
        const fcMain = item.weather[0].main.toLowerCase()
        if (fcMain.includes('cloud')) fCond = 'clouds'
        else if (fcMain.includes('rain') || fcMain.includes('drizzle') || fcMain.includes('thunder')) fCond = 'rain'
        else if (fcMain.includes('snow')) fCond = 'snow'

        daysMap[dayName] = {
          day: dayName,
          temp: Math.round(item.main.temp),
          condition: fCond,
          hour
        }
      }
    })

    const forecast = Object.values(daysMap).slice(0, 5)

    return {
      current: {
        name,
        temp,
        condition,
        description,
        humidity,
        wind,
        aqi,
        sunrise,
        sunset,
        lat,
        lon
      },
      forecast,
      hourly,
      isDemo: false
    }
  } catch (err) {
    console.error('Weather fetch error:', err)
    throw err
  }
}
