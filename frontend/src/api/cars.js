useEffect(() => {
  fetch('/api/cars')
    .then(response => response.json())
    .then(data => setCars(data));
}, []);
