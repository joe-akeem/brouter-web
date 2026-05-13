BR.Roundtrips = L.Evented.extend({
    options: {
        shortcut: {
            activate: 84, // 'T'
        },
        viaDistanceFactor: 0.20,
    },

    _active: false,
    _startLatlng: null,
    _startMarker: null,
    _lastMode: 'distance',
    _lastDistance: 30,
    _lastDuration: 3,

    initialize(routing, routingOptions) {
        this.routing = routing;
        this.routingOptions = routingOptions;
    },

    addTo(map) {
        this.map = map;

        var self = this;
        this.button = L.easyButton({
            states: [
                {
                    stateName: 'activate-roundtrip',
                    icon: 'fa-repeat',
                    onClick() {
                        self.activate(true);
                    },
                    title: i18next.t('map.roundtrip.activate'),
                },
                {
                    stateName: 'deactivate-roundtrip',
                    icon: 'fa-repeat active',
                    onClick() {
                        self.activate(false);
                    },
                    title: i18next.t('map.roundtrip.deactivate'),
                },
            ],
        });

        L.DomEvent.addListener(document, 'keydown', this._keydownListener, this);

        map.on('routing:draw-start', function () {
            self.activate(false);
        });

        return this;
    },

    activate(enable) {
        this._active = enable;
        this.button.state(enable ? 'deactivate-roundtrip' : 'activate-roundtrip');

        if (enable) {
            this.map.on('click', this._onMapClick, this);
            L.DomUtil.addClass(this.map.getContainer(), 'roundtrip-draw-enabled');
            BR.message.showInfo(i18next.t('map.roundtrip.click-hint'));
            this._hintShown = true;
        } else {
            this.map.off('click', this._onMapClick, this);
            L.DomUtil.removeClass(this.map.getContainer(), 'roundtrip-draw-enabled');
            if (this._hintShown) {
                BR.message.hide();
                this._hintShown = false;
            }
        }
    },

    _keydownListener(e) {
        if (!BR.Util.keyboardShortcutsAllowed(e)) return;
        if (e.keyCode === this.options.shortcut.activate) {
            this.activate(!this._active);
        }
    },

    _onMapClick(e) {
        this._startLatlng = e.latlng;
        this._placeMarker(e.latlng);
        this.activate(false);
    },

    _placeMarker(latlng) {
        if (this._startMarker) {
            this.map.removeLayer(this._startMarker);
        }

        var icon = L.VectorMarkers.icon({
            icon: 'repeat',
            markerColor: 'cadetblue',
        });

        var self = this;
        this._startMarker = L.marker(latlng, {
            icon: icon,
            draggable: true,
            zIndexOffset: -500,
        });

        this._startMarker.on('dragend', function (e) {
            self._startLatlng = e.target.getLatLng();
        });

        this._startMarker.on('popupopen', function () {
            self._bindPopupEvents();
        });

        this._startMarker
            .bindPopup(this._buildPopupContent(), { maxWidth: 300, minWidth: 260 })
            .addTo(this.map)
            .openPopup();
    },

    _buildPopupContent() {
        var coordText = this._startLatlng
            ? L.Util.formatNum(this._startLatlng.lat, 5) + ', ' + L.Util.formatNum(this._startLatlng.lng, 5)
            : '';
        var isDist = this._lastMode !== 'duration';

        return (
            '<div class="roundtrip-popup">' +
            '<p class="roundtrip-coords text-muted small">' + coordText + '</p>' +

            '<div class="btn-group btn-group-sm w-100 roundtrip-mode-toggle">' +
            '<button type="button" id="roundtrip-mode-distance" class="btn btn-outline-secondary' + (isDist ? ' active' : '') + '">' +
            i18next.t('map.roundtrip.mode-distance') +
            '</button>' +
            '<button type="button" id="roundtrip-mode-duration" class="btn btn-outline-secondary' + (!isDist ? ' active' : '') + '">' +
            i18next.t('map.roundtrip.mode-duration') +
            '</button>' +
            '</div>' +

            '<div class="form-group roundtrip-distance-group"' + (!isDist ? ' style="display:none"' : '') + '>' +
            '<label for="roundtrip-distance" class="control-label">' + i18next.t('map.roundtrip.distance-label') + '</label>' +
            '<div class="input-group input-group-sm">' +
            '<input type="number" id="roundtrip-distance" class="form-control" min="1" max="500" step="1" value="' + this._lastDistance + '" />' +
            '<div class="input-group-append"><span class="input-group-text">km</span></div>' +
            '</div>' +
            '</div>' +

            '<div class="form-group roundtrip-duration-group"' + (isDist ? ' style="display:none"' : '') + '>' +
            '<label for="roundtrip-duration" class="control-label">' + i18next.t('map.roundtrip.duration-label') + '</label>' +
            '<div class="input-group input-group-sm">' +
            '<input type="number" id="roundtrip-duration" class="form-control" min="0.5" max="24" step="0.5" value="' + this._lastDuration + '" />' +
            '<div class="input-group-append"><span class="input-group-text">h</span></div>' +
            '</div>' +
            '</div>' +

            '<button id="roundtrip-calculate" class="btn btn-primary btn-sm btn-block" style="margin-top:6px">' +
            i18next.t('map.roundtrip.calculate') +
            '</button>' +
            '<button id="roundtrip-clear" class="btn btn-default btn-sm btn-block" style="margin-top:4px">' +
            i18next.t('map.roundtrip.clear') +
            '</button>' +
            '</div>'
        );
    },

    _bindPopupEvents() {
        var self = this;

        var modeDistBtn = document.getElementById('roundtrip-mode-distance');
        var modeDurBtn = document.getElementById('roundtrip-mode-duration');
        var distGroup = document.querySelector('.roundtrip-distance-group');
        var durGroup = document.querySelector('.roundtrip-duration-group');

        if (modeDistBtn) {
            L.DomEvent.on(modeDistBtn, 'click', function (e) {
                L.DomEvent.stop(e);
                self._lastMode = 'distance';
                modeDistBtn.classList.add('active');
                modeDurBtn.classList.remove('active');
                distGroup.style.display = '';
                durGroup.style.display = 'none';
            });
        }

        if (modeDurBtn) {
            L.DomEvent.on(modeDurBtn, 'click', function (e) {
                L.DomEvent.stop(e);
                self._lastMode = 'duration';
                modeDurBtn.classList.add('active');
                modeDistBtn.classList.remove('active');
                distGroup.style.display = 'none';
                durGroup.style.display = '';
            });
        }

        var calcBtn = document.getElementById('roundtrip-calculate');
        if (calcBtn) {
            L.DomEvent.on(calcBtn, 'click', function (e) {
                L.DomEvent.stop(e);
                var distKm;
                if (self._lastMode === 'duration') {
                    var durInput = document.getElementById('roundtrip-duration');
                    var hours = parseFloat(durInput && durInput.value) || 3;
                    self._lastDuration = hours;
                    distKm = hours * self._profileSpeed();
                } else {
                    var distInput = document.getElementById('roundtrip-distance');
                    distKm = parseFloat(distInput && distInput.value) || 30;
                    self._lastDistance = distKm;
                }
                self._calculate(distKm);
            });
        }

        var clearBtn = document.getElementById('roundtrip-clear');
        if (clearBtn) {
            L.DomEvent.on(clearBtn, 'click', function (e) {
                L.DomEvent.stop(e);
                self.clear();
            });
        }
    },

    _profileSpeed() {
        var profile = (this.routingOptions.getOptions().profile || '').toLowerCase();
        var speeds = {
            'fastbike': 22, 'fastbike-lowtraffic': 20, 'fastbike-asia-pacific': 20,
            'vm-forum-liegerad-schnell': 25, 'vm-forum-velomobil-schnell': 30,
            'car-eco': 50, 'car-fast': 70,
            'moped': 35,
            'rail': 60,
            'river': 6,
            'hiking-mountain': 5,
        };
        return speeds[profile] || 15; // default 15 km/h covers trekking and unknown profiles
    },

    _bearingToMapCenter() {
        var start = this._startLatlng;
        var center = this.map.getCenter();
        var lat1 = (start.lat * Math.PI) / 180;
        var lat2 = (center.lat * Math.PI) / 180;
        var dLng = ((center.lng - start.lng) * Math.PI) / 180;
        var y = Math.sin(dLng) * Math.cos(lat2);
        var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
    },

    _calculate(distKm) {
        var bearing = this._bearingToMapCenter();
        var R = distKm * this.options.viaDistanceFactor;
        var via1 = this._destinationPoint(this._startLatlng, bearing + 60, R);
        var via2 = this._destinationPoint(this._startLatlng, bearing - 60, R);
        this.routing.draw(false);
        this.routing.clear();
        this.routing.setWaypoints([this._startLatlng, via1, via2, this._startLatlng]);
        this.clear();
    },

    _destinationPoint(origin, bearing, distanceKm) {
        var R = 6371;
        var d = distanceKm;
        var lat1 = (origin.lat * Math.PI) / 180;
        var lon1 = (origin.lng * Math.PI) / 180;
        var brng = (bearing * Math.PI) / 180;
        var lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d / R) + Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
        );
        var lon2 =
            lon1 +
            Math.atan2(
                Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
                Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
            );
        return L.latLng((lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI);
    },

    clear() {
        if (this._startMarker) {
            this.map.removeLayer(this._startMarker);
            this._startMarker = null;
        }
        this._startLatlng = null;
    },

    getButton() {
        return this.button;
    },
});

BR.roundtrips = function (routing, routingOptions) {
    return new BR.Roundtrips(routing, routingOptions);
};
