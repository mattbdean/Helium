function textToId(text) {
    return text.toLowerCase()
        .replace(' ', '-')
        .replace('/', '_');
}

/**
 * Attempts to convert an UpperCamelCase string into a param-case
 * string.
 */
function titleCaseToParamCase(text) {
    var times = 0;
    var regex = /[A-Z]/g;
    var indexes = [];
    var lastResult = null;

    // Find all indexes at which upper case characters exist
    do {
        lastResult = regex.exec(text);
    
        if (lastResult) {
            indexes.push(lastResult.index);
        }
    } while (lastResult && times++ < 100);

    if (indexes.length === 0)
        return text;
    
    // Start at the last occurrence and work our way backwards
    var curIndex = indexes.length - 1;

    // Separate string for eventual return value
    var newText = "";
    do {
        // Calculate the end index. If this is the last occurrence of a capital
        // letter, there is no end index (undefined)
        var endIndex = curIndex === indexes.length - 1 ? undefined : indexes[curIndex + 1];

        // Get the lower-case version of the upper-case character
        var lowerCased = text.charAt(indexes[curIndex]).toLowerCase();
        // Get all the following lower-case characters
        var theRest = text.slice(indexes[curIndex] + 1, endIndex);

        // Concatenate
        newText = lowerCased + theRest + newText;

        // Add a hyphen for param case
        if (curIndex > 0)
            newText = "-" + newText;
        curIndex--;
    } while (curIndex >= 0);

    return newText;
}

$('.api-docs h1, .api-docs h2').each(function() {
    var headerText = $(this).text();
    var nodeName = $(this).prop('nodeName');
    var id = textToId(headerText);
    var header = $('<' + nodeName + '>' + headerText + '</' + nodeName + '>')
        .attr('id', id);
    var link = $('<a class="header-link">#</a>')
        .attr('href', '#' + id);

    var container = $('<div class="local-header-wrapper"></div>')
        .append(header)
        .append(link);
    
    $(this).replaceWith(container);
});

function replaceWithGithubLink(path) {
    $(this).replaceWith($('<a></a>')
        .attr('href', 'https://github.com/mattbdean/Helium/tree/master/' + path)
        .append($('<code></code>')
            .text($(this).text())));
}

$('span[data-api-model]').each(function() {
    // Replace all spans with the [data-api-model] attribute with a link to a
    // file on GH in `/common/api`. The value of the attribute specifies the
    // type name in UpperCamelCase. If no value is provided, the type name is
    // the text content of the span.
    var attrVal = $(this).attr('data-api-model');
    var text = $(this).text();
    var typeName = attrVal ? attrVal : text;
    var fileName = titleCaseToParamCase(typeName) + '.ts';

    replaceWithGithubLink.call(this, 'common/api/' + fileName);
});

$('span[data-gh-link]').each(function() {
    var path = $(this).attr('data-gh-link');
    replaceWithGithubLink.call(this, path)
});

tocbot.init({
    tocSelector: '.toc',
    contentSelector: '.api-docs',
    headingSelector: 'h1, h2'
});

hljs.initHighlightingOnLoad();
