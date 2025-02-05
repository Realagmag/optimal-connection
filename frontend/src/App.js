import React, { useState, useEffect, useRef } from 'react';
import CityLine from './CityLine';
import CityMarker from './CityMarker';
import ReserveSpaceButton from './ReserveSpaceButton';
import ConnInfo from './ConnInfo';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  const backend_address = 'http://localhost:8000';
  const [cities, setCities] = useState({});
  const [connections, setConnections] = useState([]);
  const [startEndPath, setStartEndPath] = useState([undefined, undefined]);
  const [orangePurpleCities, setOrangePurpleCities] = useState([undefined, undefined]);
  const [pathToModify, setPathToModify] = useState(0);
  const [bestRoute, setBestRoute] = useState({route: [], channelSize: 0, cost: 0, secondRoute: [], secondCost: 0});
  const [map, setMap] = useState(null);
  const [connInfoData, setConnInfoData] = useState({});
  const [selectedSpeed, setSelectedSpeed] = useState(0);
  const [isSecondRouteSelected, setIsSecondRouteSelected] = useState(false);
  const mapRef = useRef();


  useEffect(() => {
    const fetchConnectionsData = async () => {
      try {
        const response = await fetch(backend_address + '/api/connections', {
          method: 'GET',
          credentials: 'include',
        });
        const data = await response.json();
        const cityData = {};
        data.cities.forEach(city => {
          cityData[city[0]] = [city[1], city[2]];
        });
        setCities(cityData);
        setConnections(
          data.connections.map(conn => ({
            id: conn[0],
            starting_node_id: conn[1],
            ending_node_id: conn[2],
            total_capacity: conn[3],
            provisioned_capacity: conn[4]
          }))
        );
      } catch (error) {
        console.error('Error fetching city coordinates', error);
      }
    };
    fetchConnectionsData();
  }, []);

  const handleLineClick = async (conn) => {
    if (conn.id === connInfoData.firstConn || conn.id === connInfoData.secondConn){
      setOrangePurpleCities([undefined, undefined]);
      setConnInfoData({});
      return;
    }
    try {
      const response = await fetch(backend_address + '/api/get_channels/' + conn.id , {
        method: 'GET',
        credentials: 'include'
      });

      if (response.ok){
        const data = await response.json();
        setOrangePurpleCities([String(data.orange), String(data.purple)]);
        const newConnInfo = {
          capacity: parseFloat(data.capacity),
          firstConn: data.firstConn,
          secondConn: data.secondConn,
          channels: data.channels,
        };
        setConnInfoData(newConnInfo);
      } else {
        console.warn('Invalid response from server');
      }
    } catch (error) {
      console.error('Error requesting for connection data: ', error);
    }
  };

  const handleCityClick = (id) => {
    setStartEndPath((prevPath) => {
      const updatedPath = [...prevPath];
      updatedPath[pathToModify] = id;
      return updatedPath;
    });
    setPathToModify(pathToModify === 0 ? 1 : 0);
  };

  const handleSpeedClick = (click) => {
    setSelectedSpeed(click.target.value);
  }

  const handleReserveSpaceClick = async () => {
    if (startEndPath[0] === startEndPath[1] || !startEndPath[0] || !startEndPath[1]){
      alert('invalid cities!');
      return
    }
    const csrfToken = getCookie('csrftoken');
    try {
      const response = await fetch(backend_address + '/api/reserve', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          startNode: startEndPath[0],
          endNode: startEndPath[1],
          speed: selectedSpeed,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBestRoute({
          route: data.bestRoute,
          channelSize: data.channelSize,
          bestCost: data.bestCost,
          secondRoute: data.secondRoute,
          secondCost: data.secondCost});

        setOrangePurpleCities([undefined, undefined]);
        setConnInfoData({});
      } else {
        const data = await response.json();
        alert(data.error);
      }
    } catch (error) {
      console.error('Error requesting reservation: ', error);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'row' }}>
      <MapContainer
        center={[52.0, 15.5]}
        zoom={7}
        style={{ height: '850px', width: '70%' }}
        whenReady={setMap}
        ref={mapRef}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {connections.map((conn) => (
          <CityLine
            key={`${conn.id}-${isSecondRouteSelected ? bestRoute.secondRoute.includes(conn.id) : bestRoute.route.includes(conn.id)}-${[connInfoData.firstConn, connInfoData.secondConn].includes(conn.id)}`}
            positions={[cities[conn.starting_node_id], cities[conn.ending_node_id]]}
            onClick={() => handleLineClick(conn)}
            highlight={isSecondRouteSelected ? bestRoute.secondRoute.includes(conn.id) : bestRoute.route.includes(conn.id)}
            displayingInfo={
              [connInfoData.firstConn, connInfoData.secondConn].includes(conn.id)
            }
          />
        ))}
        {Object.entries(cities).map(([id, coords]) => (
          <CityMarker
            key={id}
            position={coords}
            id={id}
            path={startEndPath}
            orangePurple={orangePurpleCities}
            onClick={() => handleCityClick(id)}

          />
        ))}
      </MapContainer>
      <div style={{
        width: '25%',
        height:'810px',
        padding: '20px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        flexDirection: 'column'}}>
        {/* From-to section */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', margin: '10px 0' }}>
            From <span style={{ color: 'green', fontStyle: 'italic', textDecoration: 'underline' }}>
              {startEndPath[0] ? startEndPath[0] : '.......'}
            </span>
            &nbsp; to <span style={{ color: 'red', fontStyle: 'italic', textDecoration: 'underline' }}>
              {startEndPath[1] ? startEndPath[1] : '.......'}
            </span>
          </p>
        </div>

        {/* GHz input */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column'}}>
          <label>
            <input type="radio" name="speed" value="40" onChange={handleSpeedClick}/> 40 &nbsp;&nbsp;Gb/s
          </label>
          <label>
            <input type="radio" name="speed" value="100" onChange={handleSpeedClick}/> 100 Gb/s
          </label>
          <label>
            <input type="radio" name="speed" value="200" onChange={handleSpeedClick}/> 200 Gb/s
          </label>
          <label>
            <input type="radio" name="speed" value="400" onChange={handleSpeedClick}/> 400 Gb/s
          </label>
        </div>
          <div style={{ marginTop: '10px' }}>
            <ReserveSpaceButton onClick={handleReserveSpaceClick} />
          </div>
        </div>

        {/* Scrollable list */}
        <div
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            border: `2px solid ${isSecondRouteSelected ? '#ddd' : 'green'}`,
            borderRadius: '6px',
            padding: '10px',
            backgroundColor: '#ffffff',
            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
          }}
          onClick={() => setIsSecondRouteSelected(false)}
        >
          {bestRoute && (
            <div
              style={{
                padding: '10px',
                marginBottom: '10px',
                border: '2px solid blue',
                borderRadius: '6px',
                backgroundColor: '#e8f4ff',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',
              }}
            >
              <p style={{ margin: '0', fontWeight: 'bold', fontSize: '12px' }}>
                Best route: {bestRoute.route?.join(' -> ')}
              </p>
              <p style={{ margin: '0', fontSize: '12px', color: '#555' }}>Cost: {bestRoute.bestCost}</p>
              <p style={{ margin: '0', fontSize: '12px', color: '#555' }}>Channel: {bestRoute.channelSize} GHz</p>
            </div>
          )}
        </div>


        <div
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            border: `2px solid ${isSecondRouteSelected ? 'green' : '#ddd'}`,
            borderRadius: '6px',
            padding: '10px',
            backgroundColor: '#ffffff',
            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
            marginBottom: '10px', // Added margin to separate from second div
          }}
          onClick={() => setIsSecondRouteSelected(true)}
        >
          {bestRoute && (
            <div
              style={{
                padding: '10px',
                marginBottom: '10px',
                border: `2px solid blue`,
                borderRadius: '6px',
                backgroundColor: '#e8f4ff',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease-in-out, border-color 0.2s ease-in-out',
              }}
            >
              <p style={{ margin: '0', fontWeight: 'bold', fontSize: '12px' }}>
                Second best route: {bestRoute.secondRoute?.join(' -> ')}
              </p>
              <p style={{ margin: '0', fontSize: '12px', color: '#555' }}>Cost: {bestRoute.secondCost}</p>
              <p style={{ margin: '0', fontSize: '12px', color: '#555' }}>Channel: {bestRoute.channelSize} GHz</p>
            </div>
          )}
          </div>


          <div style={{flexGrow:1}}></div>
        {/* ConnInfo Component */}
        <ConnInfo style={{marginTop: 'auto'}}
          key={connInfoData.firstConn}
          capacityPercent={connInfoData.capacity}
          orangePurpleId={connInfoData.firstConn}
          purpleOrangeId={connInfoData.secondConn}
          channels={connInfoData.channels}
        />
      </div>

    </div>
  );
}

function getCookie(name) {
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(name + '='))
    ?.split('=')[1];
  return cookieValue || '';
}

export default App;