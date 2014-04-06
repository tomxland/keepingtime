$(document).ready(function () {
    KeepTime.init();
});

KeepTime = 
{
    settings : {
    	api_key   : "996ba5dd257ca8430d15d6a3e36884c2",
    	lastfmAPI : "http://ws.audioscrobbler.com/2.0/?",
    },
    
    user : {
    	name : '',
    	period : '',
    	registered : 0,
    	totalTime : 0
    },
    
	request : {
    	numCompleted : 0,
    	numPages : 0,
    	sender : null,
    	lock : false
    },

    init : function()
    {
        KeepTime.bindUIActions();
                
        $('.selectpicker').selectpicker();
    },
    
    bindUIActions : function()
    {
    	$('#submit').click(KeepTime.calculate);
        
        $('form').bind("keyup keypress", function(e) {
          var code = e.keyCode || e.which; 
          if (code  == 13) {               
            e.preventDefault();
            $('#submit').click();
            return false;
          }
        });
    },

	calculate : function()
    {
    	// Only calculate if username provided and no calculations are in progress
        if (KeepTime.request.lock || $('#username').val() == "")
        {
            return;
        }
        
        $('#error-msg').hide();
        KeepTime.request.lock = true;
        KeepTime.Util.showLoading();
        
        // Reset storage
        KeepTime.user.totalTime = 0;
        KeepTime.request.numCompleted = 0;
        KeepTime.numPages = 0;
        
        KeepTime.user.name   = $('#username').val();
        KeepTime.user.period = $('#period').val();
        
        KeepTime.getUserInfo();
    },
    
    showError : function ()
    {
        $('#results').hide();
        $('#error-msg').text('Could not find information for user ' + KeepTime.user.name);
        $('#error-msg').show();
        
        clearInterval(KeepTime.request.sender);
        KeepTime.request.lock = false;
        KeepTime.Util.hideLoading();
    },
    
    getUserInfo : function()
    {
        $.getJSON( KeepTime.settings.lastfmAPI, {
            method:  "user.getinfo",
            user:    KeepTime.user.name,
            api_key: KeepTime.settings.api_key,
            format:  "json"
        })
        .done(function( data ) {

            if (data.hasOwnProperty('error'))
            {
                KeepTime.showError();
                return;
            }
            
            // Store when user registered for overall period
            KeepTime.user.registered = data.user.registered.unixtime;
            
            // Get first page of data and determine how many pages need to be retrieved
            KeepTime.getTopTracks(1);
        });
    },
    
    getTopTracks : function(page)
    {
        $.getJSON( KeepTime.settings.lastfmAPI, {
            method: "user.gettoptracks",
            user:   KeepTime.user.name,
            period: KeepTime.user.period,
            api_key: KeepTime.settings.api_key,
            limit: 200,
            page: page,
            format: "json"
        })
        .done(function( data ) {

            if (data.hasOwnProperty('error'))
            {
                KeepTime.showError();
                return;
            }
            
            var tracks = data.toptracks.track;

            for (var num in tracks)
            {
            	var time = tracks[num].playcount * tracks[num].duration;
            	
            	// Error handling for tracks without play count or duration
            	if (!isNaN(time))
            	{
            		KeepTime.user.totalTime += time;
            	}
            }

            var attr = data.toptracks['@attr'];
            
            // Handle case where user has no songs
            if (!attr && data.toptracks.totalPages == 0)
            {
                KeepTime.showResults();
                return;
            }
            else if (attr.hasOwnProperty('totalPages'))
            {
                KeepTime.numPages = parseInt(attr.totalPages);
            }

			// Track that you've completed calculations for this page of data
            KeepTime.request.numCompleted++;

			// If you've completed all pages, show results
            if (KeepTime.request.numCompleted >= KeepTime.numPages)
            {
                KeepTime.showResults();
                return;
			}
            
            // If you have the first page of data and there are more pages...
            if (page == 1)
            {
                var i = page + 1;
            
            	// Send four requests every second for remaining pages
                KeepTime.request.sender = setInterval(function(){

					// Stop when you've sent a request for every page
                    if (i > KeepTime.numPages)
                    {
                        clearTimeout(KeepTime.request.sender);
                        return;
                    }
                    
                    KeepTime.getTopTracks(i++);
                    
                }, 250);
            }
        });
    },
    
    showResults : function ()
    {
    	KeepTime.displayTime();
    	KeepTime.displayGraph();
    	KeepTime.Util.hideLoading();
        $("#results").show();
    },
    
    displayTime : function()
    {
        var str = KeepTime.formatTime(KeepTime.user.totalTime);

        $("#totalDisplay").text(str);
        $("#usernameDisplay").html(KeepTime.user.name);
        
        var time = {
            'overall' : 'overall',
            '7day'    : 'in the past 7 days',
            '3month'  : 'in the past 3 months',
            '6month'  : 'in the past 6 months',
            '12month' : 'in the past 12 months'
        }
        
        $("#spanDisplay").html(time[KeepTime.user.period]);
    },
    
    displayGraph : function()
    {
    	// Current unixtime in seconds
        var currTime = Math.floor(new Date().getTime() / 1000);
    
    	// Time periods in seconds
        var time = {
            'overall' : currTime - KeepTime.user.registered,
            '7day' 	  : 60 * 60 * 24 * 7,
            '3month'  : 60 * 60 * 24 * 30.4 * 3,
            '6month'  : 60 * 60 * 24 * 30.4 * 6,
            '12month' : 60 * 60 * 24 * 30.4 * 12,
        }
    
    	// Initialize and draw pie chart
    	var myChart = document.getElementById("myChart");
    	myChart.height = 400;
        myChart.width  = 400;
        var ctx = myChart.getContext("2d");

        var data = [
            {
                value: KeepTime.user.totalTime,
                color: "#d9534f"
            },
            {
                value : time[KeepTime.user.period] - KeepTime.user.totalTime,
                color : "#E0E4CC"
            },		
        ];
        
        var myNewChart = new Chart(ctx).Pie(data);
        
        KeepTime.request.lock = false;
    },
    
    // Adds padded zero for single digit number (e.g. '3' becomes '03')
    padDigit : function (time)
    {
        var str = time + "";
        
        if (str.length < 2)
        {
            str = "0" + str;
        }
        
        return str;
    },
    
    // Returns time in 00:00:00:00 format (days:hrs:mins:secs)
    formatTime : function (seconds)
    {
        var days = Math.floor(seconds / (60*60*24));
        seconds %= (60*60*24);
        
        var hours = Math.floor(seconds / (60*60));
        seconds %= (60*60);
        
        var minutes = Math.floor(seconds / (60));
        seconds %= (60);
        
        return KeepTime.padDigit(days) + ":" + KeepTime.padDigit(hours) + ":" + 
               KeepTime.padDigit(minutes) + ":" + KeepTime.padDigit(seconds);
    },   
    
    Util : {
    	showLoading : function()
    	{
			var left = document.documentElement.clientWidth/2 - 64;
			var top = document.documentElement.clientHeight/2 - 39;
			$('#loading').css({
				'left' : left + 'px',
				'top' : top + 'px'
			}).show();
			$('button').prop('disabled',true);
		},

		hideLoading : function()
		{
			$('#loading').hide();
			$('button').prop('disabled',false);
		}
	}, 
};