$(window).on('scroll', function() {
    var scrollTop = $(window).scrollTop(),
        bioElement = $('.bio'),
        rect = bioElement.offset(),
        treesElement = $('.trees'),
        dividerElement = $('.divider'),
        waveElement = $('.wave'),
        distance = rect.top - scrollTop;

    treesElement.css('opacity', distance / window.innerHeight);
    dividerElement.css('opacity', distance / window.innerHeight);
});
