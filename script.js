/* =====================================================
                    LOSTLINK
====================================================== */

let currentType = "all";

let currentClaimItem = "";

let uploadedReports = [];



/* =====================================================
                  CAMPUS LOCATIONS
====================================================== */

const campusLocations = {

    "Gate 01": {
        left: 49,
        top: 94
    },

    "Gate 02": {
        left: 63,
        top: 10
    },

    "Gate 03": {
        left: 43,
        top: 34
    },

    "Gate 04": {
        left: 29,
        top: 63
    },

    "Gate 05": {
        left: 91,
        top: 42
    },

    "Gate 06": {
        left: 98,
        top: 45
    },

    "Gate 07": {
        left: 42,
        top: 13
    },

    "Unity Junction": {
        left: 48,
        top: 62
    },

    "CV Raman Square": {
        left: 49,
        top: 30
    },

    "Chanakya Block": {
        left: 64,
        top: 38
    },

    "Aryabhatta Block": {
        left: 54,
        top: 21
    },

    "Bhaskara Block": {
        left: 68,
        top: 21
    },

    "Sanskriti Auditorium": {
        left: 44,
        top: 39
    },

    "Thiruvalluvar Hostel": {
        left: 33,
        top: 25
    },

    "Cholan Hostel": {
        left: 26,
        top: 47
    },

    "Pandian Hostel": {
        left: 29,
        top: 53
    },

    "Pallavan Hostel": {
        left: 24,
        top: 51
    },

    "Bharathi Hostel": {
        left: 23,
        top: 25
    },

    "Cheran Hostel": {
        left: 29,
        top: 31
    },

    "Vivekanandha Hostel": {
        left: 12,
        top: 28
    },

    "Ganga Hostel": {
        left: 95,
        top: 19
    },

    "Yamuna Hostel": {
        left: 91,
        top: 31
    },

    "Kaveri Hostel": {
        left: 91,
        top: 36
    },

    "Narmadha Hostel": {
        left: 96,
        top: 41
    },

    "Mythreyi Block": {
        left: 77,
        top: 47
    },

    "Central Park": {
        left: 80,
        top: 32
    },

    "Phoenix Circle": {
        left: 68,
        top: 64
    },

    "KPR Sports Complex": {
        left: 9,
        top: 56
    },

    "Fitness Studio": {
        left: 36,
        top: 56
    },

    "Olive Dining": {
        left: 50,
        top: 76
    },

    "Pavilion": {
        left: 48,
        top: 63
    },

    "Lake View Parking": {
        left: 56,
        top: 83
    },

    "Mahogany Parking": {
        left: 78,
        top: 13
    },

    "Aero Zone": {
        left: 85,
        top: 3
    },

    "Racing Bay": {
        left: 81,
        top: 23
    }

};



/* =====================================================
                     NEARBY LOCATIONS
====================================================== */

const nearbyMap = {

    "Central Park": [
        "Mythreyi Block",
        "Kaveri Hostel",
        "Yamuna Hostel",
        "Racing Bay",
        "Phoenix Circle"
    ],

    "Mythreyi Block": [
        "Central Park",
        "Kaveri Hostel",
        "Yamuna Hostel",
        "Phoenix Circle"
    ],

    "Phoenix Circle": [
        "Central Park",
        "Unity Junction",
        "Mythreyi Block",
        "Pavilion",
        "Chanakya Block"
    ],

    "Unity Junction": [
        "Phoenix Circle",
        "Pavilion",
        "Sanskriti Auditorium",
        "Fitness Studio",
        "CV Raman Square"
    ],

    "CV Raman Square": [
        "Aryabhatta Block",
        "Sanskriti Auditorium",
        "Unity Junction",
        "Chanakya Block"
    ],

    "Chanakya Block": [
        "CV Raman Square",
        "Mythreyi Block",
        "Phoenix Circle",
        "Aryabhatta Block"
    ],

    "Aryabhatta Block": [
        "CV Raman Square",
        "Bhaskara Block",
        "Chanakya Block",
        "Sanskriti Auditorium"
    ],

    "Bhaskara Block": [
        "Aryabhatta Block",
        "Central Park",
        "Racing Bay",
        "Mythreyi Block"
    ],

    "Sanskriti Auditorium": [
        "CV Raman Square",
        "Unity Junction",
        "Thiruvalluvar Hostel",
        "Chanakya Block"
    ],

    "KPR Sports Complex": [
        "Vivekanandha Hostel",
        "Bharathi Hostel",
        "Pallavan Hostel",
        "Pandian Hostel"
    ],

    "Thiruvalluvar Hostel": [
        "Cheran Hostel",
        "Sanskriti Auditorium",
        "Bharathi Hostel",
        "Cholan Hostel"
    ],

    "Cheran Hostel": [
        "Thiruvalluvar Hostel",
        "Cholan Hostel",
        "Pallavan Hostel"
    ],

    "Cholan Hostel": [
        "Cheran Hostel",
        "Pandian Hostel",
        "Pallavan Hostel"
    ],

    "Pandian Hostel": [
        "Cholan Hostel",
        "Pallavan Hostel",
        "Fitness Studio"
    ],

    "Pallavan Hostel": [
        "Pandian Hostel",
        "Cholan Hostel",
        "KPR Sports Complex"
    ],

    "Bharathi Hostel": [
        "Vivekanandha Hostel",
        "Thiruvalluvar Hostel",
        "Cheran Hostel"
    ],

    "Vivekanandha Hostel": [
        "Bharathi Hostel",
        "KPR Sports Complex"
    ],

    "Ganga Hostel": [
        "Yamuna Hostel",
        "Kaveri Hostel",
        "Narmadha Hostel"
    ],

    "Yamuna Hostel": [
        "Ganga Hostel",
        "Kaveri Hostel",
        "Central Park",
        "Mythreyi Block"
    ],

    "Kaveri Hostel": [
        "Yamuna Hostel",
        "Narmadha Hostel",
        "Central Park",
        "Mythreyi Block"
    ],

    "Narmadha Hostel": [
        "Kaveri Hostel",
        "Ganga Hostel",
        "Yamuna Hostel"
    ]

};



/* =====================================================
               PRIVATE VERIFICATION DATA
====================================================== */

const foundItems = {

    "Black Backpack": {

        characteristic:
            "Small blue keychain attached to the side pocket"

    },


    "Smart Watch": {

        characteristic:
            "Small scratch on the bottom-right corner"

    },


    "Mobile Phone": {

        characteristic:
            "Crack near the top-left corner of the screen"

    }

};



/* =====================================================
                         INIT
====================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        populateLocationSelects();

        setupMapClick();

        setupSearch();

        updateStats();

    }
);



/* =====================================================
                         MODALS
====================================================== */

function openModal(id) {

    const modal =
        document.getElementById(id);


    if (modal) {

        modal.classList.add("show");

    }

}


function closeModal(id) {

    const modal =
        document.getElementById(id);


    if (modal) {

        modal.classList.remove("show");

    }

}


document
    .querySelectorAll(".modal-overlay")
    .forEach(
        modal => {

            modal.addEventListener(
                "click",
                function(event) {

                    if (
                        event.target === modal
                    ) {

                        modal.classList.remove(
                            "show"
                        );

                    }

                }
            );

        }
    );



/* =====================================================
                    MOBILE MENU
====================================================== */

function toggleMenu() {

    const nav =
        document.querySelector(
            ".nav-links"
        );


    if (
        nav.style.display === "flex"
    ) {

        nav.style.display = "none";

        return;

    }


    nav.style.display = "flex";

    nav.style.position = "absolute";

    nav.style.top = "76px";

    nav.style.left = "0";

    nav.style.right = "0";

    nav.style.background = "#ffffff";

    nav.style.padding = "20px";

    nav.style.flexDirection =
        "column";

    nav.style.alignItems =
        "center";

    nav.style.borderBottom =
        "1px solid #eee";

}



/* =====================================================
                  POPULATE LOCATIONS
====================================================== */

function populateLocationSelects() {

    const ids = [

        "mapLocation",
        "lostLocation",
        "foundLocation"

    ];


    ids.forEach(
        id => {

            const select =
                document.getElementById(id);


            if (!select) {
                return;
            }


            const placeholder =
                select.options[0]
                    ?.textContent ||
                "Select location";


            select.innerHTML =
                `<option value="">
                    ${placeholder}
                </option>`;


            Object.keys(
                campusLocations
            ).forEach(
                location => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        location;


                    option.textContent =
                        location;


                    select.appendChild(
                        option
                    );

                }
            );

        }
    );

}



/* =====================================================
                    IMAGE PREVIEW
====================================================== */

function previewImage(
    input,
    previewId
) {

    const preview =
        document.getElementById(
            previewId
        );


    if (
        !input.files ||
        !input.files[0]
    ) {

        preview.src = "";

        preview.style.display =
            "none";

        return;

    }


    const file =
        input.files[0];


    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "Please select an image file."
        );

        input.value = "";

        return;

    }


    if (
        file.size >
        5 * 1024 * 1024
    ) {

        alert(
            "Image size should be less than 5 MB."
        );

        input.value = "";

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        function(event) {

            preview.src =
                event.target.result;


            preview.style.display =
                "block";

        };


    reader.readAsDataURL(file);

}



/* =====================================================
                       FILTERS
====================================================== */

function getItemCards() {

    return [
        ...document.querySelectorAll(
            ".item-card"
        )
    ];

}


function filterItems(
    type,
    button
) {

    currentType =
        type;


    document
        .querySelectorAll(
            ".filter"
        )
        .forEach(
            btn => {

                btn.classList.remove(
                    "active"
                );

            }
        );


    button.classList.add(
        "active"
    );


    applyFilters();

}


function applyFilters() {

    const category =
        document.getElementById(
            "categoryFilter"
        ).value;


    const search =
        document.getElementById(
            "heroSearch"
        ).value
        .toLowerCase()
        .trim();


    let visible = 0;


    getItemCards().forEach(
        card => {

            const typeMatch =
                currentType === "all" ||
                card.dataset.type ===
                    currentType;


            const categoryMatch =
                category === "all" ||
                card.dataset.category ===
                    category;


            const searchMatch =
                search === "" ||
                card.innerText
                    .toLowerCase()
                    .includes(search);


            const show =
                typeMatch &&
                categoryMatch &&
                searchMatch;


            card.style.display =
                show
                    ? ""
                    : "none";


            if (show) {
                visible++;
            }

        }
    );


    document.getElementById(
        "emptyState"
    ).style.display =
        visible === 0
            ? "block"
            : "none";

}


function setupSearch() {

    document
        .getElementById(
            "heroSearch"
        )
        .addEventListener(
            "input",
            applyFilters
        );

}


function searchItems() {

    document
        .getElementById(
            "browse"
        )
        .scrollIntoView({
            behavior: "smooth"
        });


    applyFilters();

}


function showAllItems() {

    currentType =
        "all";


    document
        .querySelectorAll(
            ".filter"
        )
        .forEach(
            btn => {

                btn.classList.remove(
                    "active"
                );

            }
        );


    document
        .querySelector(
            ".filter"
        )
        .classList.add(
            "active"
        );


    document.getElementById(
        "categoryFilter"
    ).value = "all";


    document.getElementById(
        "heroSearch"
    ).value = "";


    applyFilters();

}



/* =====================================================
                     MAP CLICK
====================================================== */

function setupMapClick() {

    const mapContainer =
        document.getElementById(
            "mapContainer"
        );


    mapContainer.addEventListener(
        "click",
        function(event) {

            if (
                event.target.closest(
                    ".map-marker"
                )
            ) {

                return;

            }


            const rect =
                mapContainer
                    .getBoundingClientRect();


            const x =
                event.clientX -
                rect.left;


            const y =
                event.clientY -
                rect.top;


            const clickX =
                (x / rect.width) *
                100;


            const clickY =
                (y / rect.height) *
                100;


            const nearest =
                findNearestLocation(
                    clickX,
                    clickY
                );


            if (nearest) {

                locateOnMap(
                    nearest
                );

            }

        }
    );

}



/* =====================================================
               FIND NEAREST LOCATION
====================================================== */

function findNearestLocation(
    clickX,
    clickY
) {

    let nearestLocation =
        null;


    let smallestDistance =
        Infinity;


    Object.entries(
        campusLocations
    ).forEach(
        ([location, coordinates]) => {

            const dx =
                clickX -
                coordinates.left;


            const dy =
                clickY -
                coordinates.top;


            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );


            if (
                distance <
                smallestDistance
            ) {

                smallestDistance =
                    distance;


                nearestLocation =
                    location;

            }

        }
    );


    return nearestLocation;

}



/* =====================================================
                       MAP LOCATION
====================================================== */

function locateFromSelect() {

    const location =
        document.getElementById(
            "mapLocation"
        ).value;


    if (location) {

        locateOnMap(
            location
        );

    }

}


function locateSelectedLocation() {

    const location =
        document.getElementById(
            "mapLocation"
        ).value;


    if (!location) {

        alert(
            "Please select a campus location first."
        );

        return;

    }


    locateOnMap(
        location
    );

}


function locateOnMap(
    location
) {

    const coordinates =
        campusLocations[
            location
        ];


    if (!coordinates) {

        alert(
            "This location is not available on the campus map."
        );

        return;

    }


    const marker =
        document.getElementById(
            "mapMarker"
        );


    const markerTitle =
        document.getElementById(
            "markerTitle"
        );


    marker.style.left =
        coordinates.left +
        "%";


    marker.style.top =
        coordinates.top +
        "%";


    markerTitle.textContent =
        location;


    marker.classList.remove(
        "visible"
    );


    void marker.offsetWidth;


    marker.classList.add(
        "visible"
    );


    document.getElementById(
        "mapLocation"
    ).value =
        location;


    document.getElementById(
        "mapInstruction"
    ).style.display =
        "none";


    document.getElementById(
        "selectedLocation"
    ).innerHTML = `

        <span>
            📍
        </span>

        <div>

            <strong>
                Located at ${escapeHtml(location)}
            </strong>

            <small>
                This is the selected lost/found location.
            </small>

        </div>

    `;


    showNearbyItems(
        location
    );

}



/* =====================================================
                     CLEAR MAP
====================================================== */

function clearMarker() {

    document.getElementById(
        "mapMarker"
    ).classList.remove(
        "visible"
    );


    document.getElementById(
        "mapLocation"
    ).value = "";


    document.getElementById(
        "mapInstruction"
    ).style.display =
        "block";


    document.getElementById(
        "selectedLocation"
    ).innerHTML = `

        <span>
            📍
        </span>

        <div>

            <strong>
                No location selected
            </strong>

            <small>
                Click the map or select a campus location.
            </small>

        </div>

    `;


    document.getElementById(
        "resultsTitle"
    ).textContent =
        "Select a place on the map";


    document.getElementById(
        "resultsDescription"
    ).textContent =
        "Click anywhere on the campus map to find lost and found items nearby.";


    document.getElementById(
        "exactLocationItems"
    ).innerHTML = `

        <div class="no-items">
            No location selected yet.
        </div>

    `;


    document.getElementById(
        "nearbyLocationItems"
    ).innerHTML = `

        <div class="no-items">
            Select a location to see nearby items.
        </div>

    `;

}



/* =====================================================
                    LOCATION RESULTS
====================================================== */

function getNearbyLocations(
    location
) {

    return nearbyMap[
        location
    ] || [];

}


function showNearbyItems(
    selectedLocation
) {

    const exactContainer =
        document.getElementById(
            "exactLocationItems"
        );


    const nearbyContainer =
        document.getElementById(
            "nearbyLocationItems"
        );


    document.getElementById(
        "resultsTitle"
    ).textContent =
        `Items near ${selectedLocation}`;


    document.getElementById(
        "resultsDescription"
    ).textContent =
        `Lost and found items reported at or near ${selectedLocation}.`;


    exactContainer.innerHTML =
        "";


    nearbyContainer.innerHTML =
        "";


    const allItems =
        getItemCards();


    const exactItems =
        allItems.filter(
            item =>
                item.dataset.location ===
                selectedLocation
        );


    if (
        exactItems.length === 0
    ) {

        exactContainer.innerHTML = `

            <div class="no-items">

                No lost or found items have
                been reported at
                ${escapeHtml(selectedLocation)}
                yet.

            </div>

        `;

    }

    else {

        exactItems.forEach(
            item => {

                exactContainer.appendChild(
                    createLocationItem(
                        item,
                        false
                    )
                );

            }
        );

    }


    const nearbyLocations =
        getNearbyLocations(
            selectedLocation
        );


    const nearbyItems =
        allItems.filter(
            item =>
                nearbyLocations.includes(
                    item.dataset.location
                )
        );


    if (
        nearbyItems.length === 0
    ) {

        nearbyContainer.innerHTML = `

            <div class="no-items">

                No items have been
                reported in nearby locations.

            </div>

        `;

    }

    else {

        nearbyItems.forEach(
            item => {

                nearbyContainer.appendChild(
                    createLocationItem(
                        item,
                        true
                    )
                );

            }
        );

    }

}



/* =====================================================
              LOCATION RESULT CARD
====================================================== */

function createLocationItem(
    item,
    isNearby
) {

    const name =
        item.querySelector(
            "h3"
        ).textContent;


    const type =
        item.dataset.type;


    const location =
        item.dataset.location;


    const image =
        item.querySelector(
            ".item-image img"
        );


    const icon =
        getItemIcon(
            name
        );


    const div =
        document.createElement(
            "div"
        );


    div.className =
        "location-item";


    const imageContent =
        image
            ? `<img src="${image.src}" alt="">`
            : icon;


    div.innerHTML = `

        <div class="location-item-icon">

            ${imageContent}

        </div>


        <div class="location-item-info">

            <strong>
                ${escapeHtml(name)}
            </strong>


            <span>
                📍 ${escapeHtml(location)}
            </span>


            <span
                class="location-status ${type}"
            >
                ${type.toUpperCase()}
            </span>


            ${
                isNearby
                    ? `
                        <span class="nearby-badge">
                            NEARBY
                        </span>
                      `
                    : ""
            }

        </div>

    `;


    div.addEventListener(
        "click",
        function() {

            locateItem(
                location
            );

        }
    );


    return div;

}



/* =====================================================
                       ITEM ICON
====================================================== */

function getItemIcon(
    name
) {

    const item =
        name.toLowerCase();


    if (
        item.includes("phone") ||
        item.includes("mobile")
    ) {

        return "📱";

    }


    if (
        item.includes("earbud") ||
        item.includes("airpod") ||
        item.includes("headphone")
    ) {

        return "🎧";

    }


    if (
        item.includes("bag") ||
        item.includes("backpack")
    ) {

        return "🎒";

    }


    if (
        item.includes("watch")
    ) {

        return "⌚";

    }


    if (
        item.includes("id") ||
        item.includes("card")
    ) {

        return "🪪";

    }


    if (
        item.includes("wallet")
    ) {

        return "👝";

    }


    return "📦";

}



/* =====================================================
                  LOCATE ITEM
====================================================== */

function locateItem(
    location
) {

    locateOnMap(
        location
    );


    setTimeout(
        function() {

            document
                .getElementById(
                    "campus-map"
                )
                .scrollIntoView({
                    behavior:
                        "smooth"
                });

        },
        100
    );

}



/* =====================================================
                  REPORT SUBMISSION
====================================================== */

function submitReport(
    event,
    type
) {

    event.preventDefault();


    let itemName;

    let location;

    let category;

    let description;

    let imageInput;


    if (
        type === "lost"
    ) {

        itemName =
            document.getElementById(
                "lostItemName"
            ).value.trim();


        location =
            document.getElementById(
                "lostLocation"
            ).value;


        category =
            document.getElementById(
                "lostCategory"
            ).value;


        description =
            document.getElementById(
                "lostDescription"
            ).value.trim();


        imageInput =
            document.getElementById(
                "lostItemImage"
            );

    }

    else {

        itemName =
            document.getElementById(
                "foundItemName"
            ).value.trim();


        location =
            document.getElementById(
                "foundLocation"
            ).value;


        category =
            document.getElementById(
                "foundCategory"
            ).value;


        description =
            document.getElementById(
                "foundDescription"
            ).value.trim();


        imageInput =
            document.getElementById(
                "foundItemImage"
            );

    }


    if (
        !imageInput.files ||
        !imageInput.files[0]
    ) {

        alert(
            "Please upload a photo of the item."
        );

        return;

    }


    let characteristic = "";


    if (
        type === "found"
    ) {

        characteristic =
            document.getElementById(
                "verificationCharacteristic"
            ).value.trim();


        if (!characteristic) {

            alert(
                "Please provide a private verification characteristic."
            );

            return;

        }

    }


    const file =
        imageInput.files[0];


    const reader =
        new FileReader();


    reader.onload =
        function(event) {

            const imageData =
                event.target.result;


            const report = {

                id:
                    Date.now(),

                type:
                    type,

                name:
                    itemName,

                location:
                    location,

                category:
                    category,

                description:
                    description,

                image:
                    imageData

            };


            uploadedReports.push(
                report
            );


            if (
                type === "found"
            ) {

                foundItems[
                    itemName
                ] = {

                    characteristic:
                        characteristic,

                    location:
                        location,

                    category:
                        category,

                    description:
                        description

                };

            }


            addReportCard(
                report
            );


            closeModal(
                type === "lost"
                    ? "lostModal"
                    : "foundModal"
            );


            event.target.reset();


            const preview =
                document.getElementById(
                    type === "lost"
                        ? "lostPreview"
                        : "foundPreview"
                );


            preview.src =
                "";


            preview.style.display =
                "none";


            alert(
                type === "lost"
                    ? "Lost item reported successfully!"
                    : "Found item reported successfully!"
            );


            updateStats();


            setTimeout(
                function() {

                    locateOnMap(
                        location
                    );


                    document
                        .getElementById(
                            "campus-map"
                        )
                        .scrollIntoView({
                            behavior:
                                "smooth"
                        });

                },
                250
            );

        };


    reader.readAsDataURL(
        file
    );

}



/* =====================================================
                 ADD NEW REPORT CARD
====================================================== */

function addReportCard(
    report
) {

    const grid =
        document.getElementById(
            "itemsGrid"
        );


    const article =
        document.createElement(
            "article"
        );


    article.className =
        "item-card";


    article.dataset.type =
        report.type;


    article.dataset.category =
        report.category;


    article.dataset.location =
        report.location;


    const status =
        report.type.toUpperCase();


    const statusClass =
        report.type === "lost"
            ? "lost"
            : "found";


    let claimButton =
        "";


    if (
        report.type === "found"
    ) {

        claimButton = `

            <button
                class="claim-btn"
                onclick='openClaimModal(${JSON.stringify(report.name)})'
            >
                Claim Item
            </button>

        `;

    }


    article.innerHTML = `

        <div class="item-image">

            <img
                src="${report.image}"
                alt="${escapeHtml(report.name)}"
            >


            <span
                class="status ${statusClass}"
            >
                ${status}
            </span>

        </div>


        <div class="item-body">

            <div class="item-title">

                <h3>
                    ${escapeHtml(report.name)}
                </h3>

                <span>
                    ⋮
                </span>

            </div>


            <p class="location">

                📍
                ${escapeHtml(report.location)}

            </p>


            <p class="date">
                Posted just now
            </p>


            <div class="item-actions">

                <button
                    onclick='locateItem(${JSON.stringify(report.location)})'
                >
                    Locate on map →
                </button>

                ${claimButton}

            </div>

        </div>

    `;


    grid.prepend(
        article
    );

}



/* =====================================================
                  CLAIM ITEM
====================================================== */

function openClaimModal(
    itemName
) {

    currentClaimItem =
        itemName;


    document.getElementById(
        "claimItemName"
    ).textContent =
        itemName;


    document.getElementById(
        "claimAnswer"
    ).value =
        "";


    document.getElementById(
        "claimAnswer"
    ).classList.remove(
        "verification-error"
    );


    openModal(
        "claimModal"
    );

}



/* =====================================================
                  VERIFY CLAIM
====================================================== */

function verifyClaim(
    event
) {

    event.preventDefault();


    const answer =
        document.getElementById(
            "claimAnswer"
        ).value
        .trim()
        .toLowerCase();


    const item =
        foundItems[
            currentClaimItem
        ];


    if (!item) {

        alert(
            "Verification information is not available for this item."
        );

        return;

    }


    const correctAnswer =
        item.characteristic
        .trim()
        .toLowerCase();


    const answerWords =
        answer
        .split(/\s+/)
        .filter(
            word =>
                word.length > 2
        );


    const correctWords =
        correctAnswer
        .split(/\s+/)
        .filter(
            word =>
                word.length > 2
        );


    const matchedWords =
        answerWords.filter(
            word =>
                correctWords.some(
                    correctWord =>
                        correctWord.includes(
                            word
                        ) ||
                        word.includes(
                            correctWord
                        )
                )
        );


    /*
        Frontend demo matching.

        Production version should do
        this verification on the backend.
    */

    const isMatch =
        answer === correctAnswer ||
        matchedWords.length >= 2;


    if (isMatch) {

        showVerificationSuccess();

    }

    else {

        showVerificationFailure();

    }

}



/* =====================================================
                VERIFICATION SUCCESS
====================================================== */

function showVerificationSuccess() {

    const modal =
        document.getElementById(
            "claimModal"
        );


    modal.innerHTML = `

        <div class="modal verification-result">

            <button
                class="close"
                onclick="closeModal('claimModal')"
            >
                ×
            </button>


            <div class="result-icon success">
                ✓
            </div>


            <span class="eyebrow">
                VERIFICATION PASSED
            </span>


            <h2>
                Ownership detail matched
            </h2>


            <p>

                The characteristic you provided
                matches the private information
                associated with this item.

            </p>


            <div class="next-step-box">

                <strong>
                    What happens next?
                </strong>


                <span>

                    Your claim can now proceed
                    to the finder/owner contact step.

                </span>

            </div>


            <button
                class="primary-btn full"
                onclick="closeModal('claimModal')"
            >
                Continue
            </button>

        </div>

    `;


    modal.classList.add(
        "show"
    );

}



/* =====================================================
                VERIFICATION FAILURE
====================================================== */

function showVerificationFailure() {

    const answer =
        document.getElementById(
            "claimAnswer"
        );


    answer.classList.add(
        "verification-error"
    );


    alert(

        "The characteristic did not match.\n\n" +

        "Please provide a specific detail " +

        "about the item that only the owner " +

        "would know."

    );


    setTimeout(
        function() {

            answer.classList.remove(
                "verification-error"
            );

        },
        1500
    );

}



/* =====================================================
                       LOGIN
====================================================== */

function loginDemo(
    event
) {

    event.preventDefault();


    alert(

        "Login submitted!\n\n" +

        "Authentication will be connected later."

    );


    event.target.reset();


    closeModal(
        "loginModal"
    );

}



/* =====================================================
                        STATS
====================================================== */

function updateStats() {

    const count =
        getItemCards().length;


    document.getElementById(
        "statListed"
    ).textContent =
        `${count}+`;


    const foundCount =
        getItemCards()
        .filter(
            card =>
                card.dataset.type ===
                "found"
        )
        .length;


    document.getElementById(
        "statActive"
    ).textContent =
        foundCount;

}



/* =====================================================
                   HTML ESCAPE
====================================================== */

function escapeHtml(
    value
) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}