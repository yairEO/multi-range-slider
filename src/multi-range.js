// (C) Yair Even-Or 2017
// DO NOT COPY

(function(){

/**
 * Extends the first Object with the properties and values of the second
 */
function extend(o1, o2){
    for( var key in o2 )
        if( o2.hasOwnProperty(key) ){
            o1[key] = isNaN(+o2[key]) || typeof o2[key] != 'string' ? o2[key] : +o2[key];
        }
    return o1;
};

/**
 * Converts a number to a localiazed number, with only 1 decimal point allowed and slice any trailing ".0" from the end, if any
 * Example: 123456.254 -> "123,456.3"
 * @param  {Number} v
 * @return {String}
 */
function prettyValue(v){
    return v.toLocaleString(undefined, {maximumFractionDigits:1}).replace('.0', '')
}

var state = {
    groups : [], // a 2D array of slices' groups which contain the ranges indexes which are grouped. for example, the values: 5,20,50,90 (which are 5 ranges if the maxRange is "100"), the groups could be: [[2,3]] where "20" is grouped with "50"
    rangesPercentages : []
}

this.MultiRange = function MultiRange( placeholderElm, settings ){
    var placeholderElmSettings = {}; // settings which might have been applied on the placeholder element itself

    settings = typeof settings == 'object' ? settings : {}; // make sure settings is an 'object'

    if( placeholderElm )
        extend(placeholderElmSettings, placeholderElm.dataset)

    this.settings = extend({}, this.defaults); // clone the default settings
    this.settings = extend(this.settings, placeholderElmSettings); // merge inline settings with the defaults
    this.settings = extend( this.settings, settings); // merge the above with script settings

    this.delta = this.settings.max - this.settings.min;

    // if "ticks" count was defined, re-calculate the "tickStep"
    if( settings.ticks )
        this.settings.tickStep = this.delta / settings.ticks;

    // a state object with things which are temporary, and are needed for calculations (during events)
    this.state = extend({}, state);

    // a list of ranges (ex. [5,20])
    this.ranges = settings.ranges || [
        this.settings.min + this.settings.tickStep,
        this.settings.max - this.settings.tickStep
    ]

    this.id = Math.random().toString(36).substr(2,9), // almost-random ID (because, fuck it)
    this.DOM = {}; // Store all relevant DOM elements in an Object
    extend(this, new this.EventDispatcher());
    this.build(placeholderElm);

    this.events.binding.call(this);
}

this.MultiRange.prototype = {
    defaults : {
        minRange   : 1,
        tickStep   : 5,
        roundTicks : true,
        step       : 1,
        min        : 0,
        max        : 100,
    },

    /**
     * A constructor for exposing events to the outside
     */
    EventDispatcher : function(){
        // Create a DOM EventTarget object
        var target = document.createTextNode('');

        // Pass EventTarget interface calls to DOM EventTarget object
        this.off = target.removeEventListener.bind(target);
        this.on = target.addEventListener.bind(target);
        this.trigger = function(eventName, data){
            if( !eventName ) return;
            var e = new CustomEvent(eventName, {"detail":data});
            target.dispatchEvent(e);
        }
    },

    build : function( placeholderElm ){
        var that = this,
            scopeClasses = placeholderElm.className.indexOf('multiRange') == -1 ?
                            'multiRange ' + placeholderElm.className :
                            placeholderElm.className;

        this.DOM.scope = document.createElement('div');
        this.DOM.scope.className = scopeClasses;

        this.DOM.rangeWrap = document.createElement('div');
        this.DOM.rangeWrap.className = 'multiRange__rangeWrap';
        this.DOM.rangeWrap.innerHTML = this.getRangesHTML();

        this.DOM.ticks = document.createElement('div');
        this.DOM.ticks.className = 'multiRange__ticks';
        this.DOM.ticks.innerHTML = this.getTicksHTML();

        // append to Scope
        this.DOM.scope.appendChild(this.DOM.rangeWrap);
        this.DOM.scope.appendChild(this.DOM.ticks);

        // replace the placeholder component element with the real one
        placeholderElm.parentNode.replaceChild(this.DOM.scope, placeholderElm);
    },

    getTicksHTML : function(){
        var steps = (this.delta) / this.settings.tickStep,
            HTML = '',
            value,
            i;

        for( i = 0; i <= steps; i++ ){
            value =(+this.settings.min) + this.settings.tickStep * i; // calculate tick value

            if( this.settings.roundTicks )
                value = Math.round(value);

            value = prettyValue(value);
            HTML += '<div data-value="'+ value +'"></div>';
        }

        return HTML;
    },

    getRangesHTML : function(){
        var that = this,
            rangesHTML = '',
            ranges;

        this.ranges.unshift(0)
      //  if( this.ranges[0] > this.settings.min )
      //      this.ranges.unshift(this.settings.min)
        if( this.ranges[this.ranges.length - 1] < this.settings.max )
            this.ranges.push(this.settings.max);

        ranges = this.ranges;

        ranges.forEach(function(range, i){
            if( i == ranges.length - 1 ) return; // skip last ltem

            var leftPos = (range - that.settings.min) / (that.delta) * 100,
                rightPos = 100 - (ranges[i+1] - that.settings.min) / (that.delta) * 100;

            // protection..
            if( leftPos < 0 )
                leftPos = 0;

            that.state.rangesPercentages[i] = leftPos;

           // range =  ranges[i+1] - range;
            rangesHTML += '<div data-idx="'+i+'" class="multiRange__range" \
                style="left:'+ leftPos +'%; right:'+ rightPos +'%;">\
                <div class="multiRange__range__handle"></div>\
                <div class="multiRange__range__value">'+ range.toFixed(1).replace('.0', '') +'</div>\
            </div>';
        })

        return rangesHTML;
    },

    groupValues2 : function(){
            console.warn('------')

        var rects = [], // rects array for all the ranges' values
            overlap, // boolean flag
            valueElm,
            tempGroups = [],
            slicesCount = this.DOM.rangeWrap.children.length,
            i;

        this.state.groups.length = 0;

        // step 1 - Iterate all slices. sollect all their values' rects
        // do not include the first range because its value isn't shown
        for( i = slicesCount; i-- > 1; ){
            valueElm = this.DOM.rangeWrap.children[i].querySelector('.multiRange__range__value');
            rects.push( valueElm.getBoundingClientRect() );
        }

        // step 2 -  Iterate all the rects and check which overlap which. save the each "touching" slice index in the "groups" state object. add "null" between not overlapped slices
        for( i = rects.length; i-- > 1; ){
            overlap = rects[i].x + rects[i].width >= rects[i-1].x;

            var sliceIdx = rects.length-i,
                lastGropsValue = tempGroups[tempGroups.length-1];

            if( overlap ){
                // prevent duplicates
                if( lastGropsValue != sliceIdx )
                    tempGroups.push(sliceIdx);
                tempGroups.push(sliceIdx+1);
            }
            else if( tempGroups.length ){
                this.state.groups.push(tempGroups);
                tempGroups = [];
            }
        }

        // if anything was left by the end of the loop in the tempGroups array, add it to the state.groups array
        // (this is because if the last slice was overlapped, the code will never go to the "else if" which pushed the tempGroups array into the state.groups array)
        if( tempGroups.length )
            this.state.groups.push(tempGroups);

        // step 3 - Hide slices' values which are touching others
        for( i = 1; i < slicesCount; i++ ){
            this.DOM.rangeWrap.children[i].classList.toggle('hideValue', this.state.groups.toString().indexOf(i) != -1 );
        }

        // this.state.groups.forEach(function(v){
        //     that.DOM.rangeWrap.children[v].classList.toggle('hideValue')
        //     if( v ){
        //         var valueElm = that.DOM.rangeWrap.children[v].querySelector('.multiRange__range__value')
        //     }
        // })

        console.log(this.state.groups);
    },


    // returns the "state" to a good working order after a mousedown event (which added things to it)
    stateCleaup : function(){
        var _state = this.state; // save last state
        this.state = extend({}, state); // reset the state.
        this.state.groups = _state.groups;
        this.state.rangesPercentages = _state.rangesPercentages;
    },

    /**
     * DOM events listeners binding
     */
    events : {
        binding : function(){
            this.DOM.rangeWrap.addEventListener('mousedown', this.events.callbacks.onMouseDown.bind(this))
            //prevent anything from being able to be dragged
            this.DOM.scope.addEventListener("dragstart", function(e){ return false });
           // this.eventDispatcher.on('add', this.settings.callbacks.add)
        },
        callbacks : {
            onMouseDown : function(e){
                var target = e.target;
                if( !target ) return;

                else if( 'multiRange__range__handle, multiRange__range__value'.indexOf(target.className) == -1 )
                    return;

                this.DOM.currentSlice = target.parentNode;

                // set some variables (so percentages could be calculated on mousemove)
                var scopeClientRect = this.DOM.scope.getBoundingClientRect(),
                    previousElementSibling = this.DOM.currentSlice.previousElementSibling,
                    nextElementSibling =  this.DOM.currentSlice.nextElementSibling;

                this.state.offsetLeft = scopeClientRect.left;
                this.state.scopeWidth = scopeClientRect.width;

                // get previous range value client rect (for merging values when two get close)
                if( previousElementSibling ){
                    previousElementSibling = previousElementSibling.querySelector('.multiRange__range__value').getBoundingClientRect();
                    this.state.previousSliceOffsetLeft = previousElementSibling.left + previousElementSibling.width; // from right
                }
                if( nextElementSibling )
                    this.state.nextSliceOffsetLeft = nextElementSibling.querySelector('.multiRange__range__value').getBoundingClientRect().left;

                this.DOM.currentSlice.classList.add('grabbed');
                this.DOM.currentSliceValue = this.DOM.currentSlice.querySelector('.multiRange__range__value');

                document.body.classList.add('multiRange-grabbing');

                // bind temporary events (save "bind" reference so events could later be removed)
                this.events.onMouseUpFunc = this.events.callbacks.onMouseUp.bind(this);
                this.events.mousemoveFunc = this.events.callbacks.onMouseMove.bind(this);

                window.addEventListener('mouseup', this.events.onMouseUpFunc)
                window.addEventListener('mousemove', this.events.mousemoveFunc)
            },

            onMouseUp : function(e){
                this.DOM.currentSlice.classList.remove('grabbed');
                window.removeEventListener('mousemove', this.events.mousemoveFunc);
                window.removeEventListener('mouseup', this.events.onMouseUpFunc);
                document.body.classList.remove('multiRange-grabbing');

                // publish "changed" event
                this.trigger('changed', {idx:+this.DOM.currentSlice.dataset.idx, value:this.ranges[this.DOM.currentSlice.dataset.idx], ranges:this.ranges})

                this.DOM.currentSlice = null;

                this.stateCleaup();
            },

            onMouseMove : function(e){
                if( !this.DOM.currentSlice ){
                    window.removeEventListener('mouseup', this.events.onMouseUpFunc);
                    return;
                }

                // do not continue if the mouse was overflowing of the left or the right side of the range
                if(  e.clientX < this.offsetLeft || e.clientX > (this.offsetLeft + this.scopeWidth) )
                    return;

                var that = this,
                    value, // the numeric value
                    index = +this.DOM.currentSlice.dataset.idx,
                    // minLeftPerc = this.settings.minRange/this.delta*100,
                    // minRightPerc = (this.delta - this.settings.minRange)/this.delta*100,
                    xPosScopeLeft = e.clientX - this.state.offsetLeft, // the left percentage value
                    leftPrecentage = xPosScopeLeft / this.state.scopeWidth * 100,
                    prevSliceValue = this.ranges[+this.DOM.currentSlice.dataset.idx - 1],
                    nextSliceValue = this.ranges[+this.DOM.currentSlice.dataset.idx + 1];

                value = this.settings.min + (this.delta/100*leftPrecentage);

                if( this.settings.step ){
                   // if( value%this.settings.step > 1 ) return;
                    value = Math.round((value) / this.settings.step ) * this.settings.step
                }

                // make sure a slice value doesn't go above the next slice value and not below the previous one
                if( value < prevSliceValue + this.settings.minRange )
                    value = prevSliceValue + this.settings.minRange;
                if( value > nextSliceValue - this.settings.minRange )
                    value = nextSliceValue - this.settings.minRange;

                // define min and max move points
                if( value < (this.settings.min + this.settings.minRange) )
                    value = this.settings.min + this.settings.minRange;
                if( value > (this.settings.max - this.settings.minRange) )
                    value = this.settings.max - this.settings.minRange;

                leftPrecentage = (value - this.settings.min) / this.delta * 100;
                this.state.rangesPercentages[index] = leftPrecentage;

                // update the DOM (only if value was changed)
                if( value != this.state.currentSliceValue )
                    window.requestAnimationFrame(function(){
                        if( that.DOM.currentSlice ){
                            that.DOM.currentSlice.style.left = leftPrecentage + '%';
                            that.DOM.currentSliceValue.firstChild.nodeValue = value.toFixed(1).replace('.0', '');
                            // adjust the previous slice
                            that.DOM.currentSlice.previousElementSibling.style.right = 100 - leftPrecentage + '%';
                        }

                        that.groupValues2();
                    })

                // save the value on the "state" object
                this.state.currentSliceValue = value;

                // update "ranged" Array
                this.ranges[this.DOM.currentSlice.dataset.idx] = +value.toFixed(1);

                // publish "change" event
                this.trigger('change', {idx:index, value:value, ranges:this.ranges})
            }
        }
    }
}
})(this);