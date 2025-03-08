/**
 * @license
 * Copyright 2024 Google LLC. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
async function initMap() {
    const { Map, InfoWindow } = await google.maps.importLibrary("maps");
    const { Autocomplete } = await google.maps.importLibrary("places");
    const { AdvancedMarkerElement, PinElement} = await google.maps.importLibrary("marker");

    const mapOptions = {
        center: { lat: 28.43268, lng: 77.0459 }, // Initial center coordinates (Gurgaon)
        zoom: 16,
        mapStyle: 'https://maps.googleapis.com/maps/api/js/examples/styles/minimal_hosting.json', // Optional map style
        mapId: "f8b9e6163e48e501"
    };

    const map = new Map(document.getElementById("map"), mapOptions);

    const landmarksSelect = document.getElementById('landmarks');
    const combinedAddressInput = document.getElementById('combined-address');
    let formattedAddress = "";

    const geocoder = new google.maps.Geocoder(); // Initialize geocoder

    let marker = new AdvancedMarkerElement({
        map,
        position: mapOptions.center,
        gmpDraggable: true
    });
    let infoWindow;
    const descriptorMarkers = []; // Array to store landmark markers

    const addressInput = document.getElementById('address-autocomplete');
    const aptSuiteInput = document.getElementById('apt-suite');
    const cityInput = document.getElementById('city');
    const stateProvinceInput = document.getElementById('state-province');
    const zipPostalCodeInput = document.getElementById('zip-postal-code');
    const countryInput = document.getElementById('country');

    const autocomplete = new google.maps.places.Autocomplete(addressInput, {
        fields: ['place_id', 'address_components', 'formatted_address', 'geometry', 'name']
        // You can add restrictions here, e.g., componentRestrictions: { country: 'us' }
    });

    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry) {
            console.error("No details available for input: '" + place.name + "'");
            return;
        }

        marker.position = place.geometry.location;
        // Update map with selected location
        map.setCenter(place.geometry.location);

        // Fill in the form fields
        fillInAddress(place);
        formattedAddress = place.formatted_address;

        // Get address descriptor landmarks
        addressDescriptorPlaceIdLookup(place.place_id);

        infoWindow = new InfoWindow({
            content: place.name,
            headerDisabled: true     // Hide the header
        });

        infoWindow.open(map, marker); // Open infoWindow by default

    });

    function fillInAddress(place) {
        // Clear previous values
        aptSuiteInput.value = '';
        cityInput.value = '';
        stateProvinceInput.value = '';
        zipPostalCodeInput.value = '';
        countryInput.value = '';

        // Get each component of the address from the place details
        // and fill the corresponding field on the form.
        for (const component of place.address_components) {
            const componentType = component.types[0];

            switch (componentType) {
                case 'street_number': {
                    addressInput.value = `${component.long_name} `;
                    break;
                }

                case 'route': {
                    addressInput.value += component.short_name;
                    break;
                }

                case 'premise': {
                    aptSuiteInput.value = component.short_name;
                    break;
                }

                case 'subpremise': {
                    aptSuiteInput.value = component.short_name;
                    break;
                }

                case 'locality':
                    cityInput.value = component.long_name;
                    break;
                case 'administrative_area_level_1': {
                    stateProvinceInput.value = component.short_name;
                    break;
                }
                case 'postal_code': {
                    zipPostalCodeInput.value = component.long_name;
                    break;
                }
                case 'country':
                    countryInput.value = component.long_name;
                    break;
            }
        }

        M.updateTextFields();
    }

    function addressDescriptorPlaceIdLookup(placeId) {
        geocoder.geocode({
            'placeId': placeId,
            'extraComputations': ['ADDRESS_DESCRIPTORS'],
            'fulfillOnZeroResults': true
        }, function(results, status) {
            if (status == 'OK') {
                let addressDescriptor = results[0].address_descriptor;
                if(addressDescriptor) {
                    const descriptors = results[0].address_descriptor.landmarks;
                    landmarksSelect.innerHTML = '<option value="" disabled selected>Choose your Landmark</option>';

                    // Clear existing descriptor markers
                    descriptorMarkers.forEach(marker => marker.setMap(null));
                    descriptorMarkers.length = 0;

                    descriptors.forEach((descriptor, index) => {

                        const option = document.createElement('option');
                        option.value = descriptor.display_name; // Assuming landmarks have place_ids
                        option.text = descriptor.spatial_relationship + " " + descriptor.display_name;
                        landmarksSelect.appendChild(option);

                        const descriptorMarkerContent = document.createElement('div');
                        if (index === 0) {
                            descriptorMarkerContent.className = 'descriptor-marker highlighted';
                        } else {
                            descriptorMarkerContent.className = 'descriptor-marker';
                        }
                        //increment index for display
                        descriptorMarkerContent.textContent = ++index;

                        // Get landmark location
                        geocoder.geocode({ placeId: descriptor.place_id }, (results, status) => {
                            if (status === "OK") {

                                // Create infoWindow for landmark marker
                                const landmarkInfoWindow = new InfoWindow({
                                    content: descriptor.display_name,
                                    headerDisabled: true
                                });

                                const _marker = new AdvancedMarkerElement({
                                    map: map,
                                    position: results[0].geometry.location,
                                    content: descriptorMarkerContent
                                });
                                descriptorMarkers.push(_marker); // Add marker to the array

                                // Add mouseover and mouseout listeners for the info window
                                _marker.content.addEventListener("mouseover", () => {
                                    landmarkInfoWindow.open(map, _marker);
                                });
                                _marker.content.addEventListener("mouseout", () => {
                                    landmarkInfoWindow.close();
                                });

                            } else {
                                console.error("Error geocoding landmark:", status);
                            }
                        });
                    });

                    // Autoselect the first option:
                    if (landmarksSelect.options.length > 1) {
                        landmarksSelect.selectedIndex = 1;
                        updateCombinedAddress();
                        M.FormSelect.init(landmarksSelect); // Re-initialize Materialize select
                    }
                } else {
                    //clear landmark drop down
                    removeOptions(landmarksSelect);
                    //clear Address Field
                    combinedAddressInput.value = "";
                    alert("No Landmarkers available");
                }

            } else {
                window.alert('Geocode was not successful for the following reason: ' + status);
            }
        });
    }

    // Function to update the combined address field
    function updateCombinedAddress() {
        const address = formattedAddress;
        const landmark = landmarksSelect.options[landmarksSelect.selectedIndex].text;
        //console.log("landmark ==>" + landmark)
        combinedAddressInput.value = `${address}\n${landmark}`;
        M.updateTextFields(); // Update Materialize text fields
    }

    // Add an event listener to the landmarks dropdown to update the combined address
    landmarksSelect.addEventListener('change', () => {
        updateCombinedAddress();

        // Highlight the selected landmark marker
        const selectedIndex = landmarksSelect.selectedIndex - 1;
        descriptorMarkers.forEach((marker, index) => {
            if (selectedIndex === (parseInt(marker.content.textContent)-1)) {
                marker.content.classList.add("highlighted");
            } else {
                marker.content.classList.remove("highlighted");
            }
        });
    });


    // Add marker dragend listener
    marker.addListener('dragend', () => {
        const newPosition = marker.position;
        geocoder.geocode({
            location: newPosition,
            'extraComputations': ["ADDRESS_DESCRIPTORS"],
            'fulfillOnZeroResults': true
        }, (results, status) => {
            if (status === "OK") {
                //console.log(results)
                if (results[0]) {
                    const place = results[0];
                    // Update the form fields with the new address
                    fillInAddress(place);
                    formattedAddress = place.formatted_address;
                    // Update the combined address field
                    updateCombinedAddress();
                    // You might also want to update the landmarks dropdown here
                    addressDescriptorPlaceIdLookup(place.place_id);
                    map.setCenter(newPosition);
                } else {
                    window.alert("No results found");
                }
            } else {
                window.alert("Geocoder failed due to: " + status);
            }
        });
    });

}

function removeOptions(selectElement) {
    var instance = M.FormSelect.getInstance(selectElement);
    instance.destroy(); // Destroy the Materialize instance

    var i, L = selectElement.options.length - 1;
    for(i = L; i >= 0; i--) {
        selectElement.remove(i);
    }

    // Re-initialize the select
    instance = M.FormSelect.init(selectElement);
}


initMap();