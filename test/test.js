"use strict";
/* -*- mode: Javascript -*-

turtle-to-jsonld
Copyright 2013 Kuno Woudt <kuno@frob.nl>

turtle-to-jsonld is licensed under Apache v2, see
LICENSE.txt for more information.

*/

var parser = require('../lib/turtle-to-jsonld.js');
var assert = require('assert');

var graph_to_hash = function (graph) {
    var ret = {};
    for (var idx in graph) {
        var item = graph[idx];
        ret[item['@id']] = item;
    };
    return ret;
};

suite ('Parser', function () {
    suite ('Term', function () {

        test ('iri', function () {
            var term = parser.term ('https://example.com/iri/');
            assert.equal (term.type, 'IRI');
            assert.equal (term.value, 'https://example.com/iri/');
        });

        test ('blank node', function () {
            var term = parser.term ('_:example');
            assert.equal (term.type, 'blank node');
            assert.equal (term.value, '_:example');
        });

        test ('literal', function () {
            var term = parser.term ('"aap"');
            assert.equal (term.type, 'literal');
            assert.equal (term.value, 'aap');
            assert.equal (term.datatype, 'http://www.w3.org/2001/XMLSchema#string');
            assert.equal (term.language, undefined);
        });

        test ('literal with language tag', function () {
            var term = parser.term ('"aap"@fy-NL');
            assert.equal (term.type, 'literal');
            assert.equal (term.value, 'aap');
            assert.equal (term.datatype, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString');
            assert.equal (term.language, 'fy-nl');
        });

        test ('literal with datatype', function () {
            var term = parser.term ('"aap"^^https://example.com/noot#mies');
            assert.equal (term.type, 'literal');
            assert.equal (term.value, 'aap');
            assert.equal (term.datatype, 'https://example.com/noot#mies');
            assert.equal (term.language, undefined);
        });

    });

    suite ('Compact from turtle', function () {

        test ('no graph', function () {
            var input = [
                '@prefix dc: <http://purl.org/dc/terms/> .',
                '',
                '<https://example.com/titerito> dc:title "Titerito"@es .'
            ].join ("\n");

            var expected = {
                '@context': { 'dc': 'http://purl.org/dc/terms/' },
                '@id': 'https://example.com/titerito',
                'dc:title': {
                    '@language': 'es',
                    '@value': 'Titerito',
                }
            };

            return parser.compactFromTurtle (input).then (function (result) {
                assert.deepEqual (result, expected);
            });
        });

        test ('with graph', function () {

            var input = [
                '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
                '@prefix test: <https://example.com/ns#> .',
                '',
                'test:titerito foaf:maker test:farruko .',
                'test:farruko foaf:familyName "Reyes Rosado" .'
            ].join ("\n");

            return parser.compactFromTurtle (input).then (function (result) {
                assert.deepEqual (result['@context'], {
                    'foaf': 'http://xmlns.com/foaf/0.1/',
                    'test': 'https://example.com/ns#'
                });

                var graph = graph_to_hash (result['@graph']);

                assert.deepEqual (graph['test:farruko'], {
                    '@id': 'test:farruko',
                    'foaf:familyName': 'Reyes Rosado'
                });

                assert.deepEqual (graph['test:titerito'], {
                    '@id': 'test:titerito',
                    'foaf:maker': { '@id': 'test:farruko' }
                });
            });

        });

        test ('native datatypes', function () {

            var input = [
                '@prefix ex: <https://example.com/> .',
                '@prefix hydra: <http://purl.org/hydra/core#> .',
                '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
                '',
                'ex:statusOK hydra:statusCode "200"^^xsd:integer .',
                'ex:statusNotFound hydra:statusCode 404 .',
                'ex:prop hydra:readonly true .',
                'ex:prop hydra:writeonly "true"^^xsd:boolean .'
            ].join ("\n");

            parser.compactFromTurtle (input).then (function (result) {
                assert.equal (err, null);

                var graph = graph_to_hash (result['@graph']);

                assert.deepEqual (graph['ex:statusOK'], {
                    '@id': 'ex:statusOK', 'hydra:statusCode': 200,
                });

                assert.deepEqual (graph['ex:statusNotFound'], {
                    '@id': 'ex:statusNotFound', 'hydra:statusCode': 404,
                });

                assert.deepEqual (graph['ex:prop'], {
                    '@id': 'ex:prop',
                    'hydra:readonly': true,
                    'hydra:writeonly': true,
                });
            });

        });

        test ('triple quoted literal', function () {

            var input = [
                '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
                '',
                '<> rdfs:comment """',
                'This is a multiline comment.',
                '"""@en .'
            ].join ("\n");

            parser.compactFromTurtle (input).then (function (result) {
                assert.equal (result['rdfs:comment']['@language'], 'en');
                assert.equal (result['rdfs:comment']['@value'],
                             "\nThis is a multiline comment.\n");
            });
        });

        test ('with context', function () {

            var context = {
                '@context': {
                    'foaf': 'http://xmlns.com/foaf/0.1/',
                    'test': 'https://example.com/ns#',
                    'author': { '@id': 'foaf:maker' },
                    'lastName': { '@id': 'foaf:familyName' }
                }
            };

            var input = [
                '@prefix test: <https://example.com/ns#> .',
                '',
                'test:titerito <http://xmlns.com/foaf/0.1/maker> test:farruko .',
                'test:farruko <http://xmlns.com/foaf/0.1/familyName> "Reyes Rosado" .'
            ].join ("\n");

            return parser.compactFromTurtle (input, context).then (function (result) {
                assert.deepEqual (result['@context'], {
                    'foaf': 'http://xmlns.com/foaf/0.1/',
                    'test': 'https://example.com/ns#',
                    'author': { '@id': 'foaf:maker' },
                    'lastName': { '@id': 'foaf:familyName' }
                });

                var graph = graph_to_hash (result['@graph']);

                assert.deepEqual (graph['test:farruko'], {
                    '@id': 'test:farruko',
                    'lastName': 'Reyes Rosado'
                });

                assert.deepEqual (graph['test:titerito'], {
                    '@id': 'test:titerito',
                    'author': { '@id': 'test:farruko' }
                });
            });

        });

        test ('with root', function () {

            var context = {
                '@context': {
                    'foaf': 'http://xmlns.com/foaf/0.1/',
                    'test': 'https://example.com/ns#',
                    'schema': 'http://schema.org/',
                    'author': { '@id': 'foaf:maker' },
                    'lastName': { '@id': 'foaf:familyName' },
                    'schema:url': { '@type': '@id' },
                    'schema:sameAs': { '@type': '@id' }
                }
            };

            var input = [
                '@prefix test: <https://example.com/ns#> .',
                '@prefix mbrec: <http://musicbrainz.org/recording/> .',
                '',
                'test:titerito <http://xmlns.com/foaf/0.1/maker> test:farruko;',
                '    <http://schema.org/url> <http://youtu.be/X4lkfFpHw-8>.',
                '<http://youtu.be/X4lkfFpHw-8> a <http://schema.org/CreativeWork>;',
                '<http://schema.org/sameAs> mbrec:5016995f-0abc-4193-8a6d-0d16e6669396.',
                'test:farruko <http://xmlns.com/foaf/0.1/familyName> "Reyes Rosado";',
                '    <http://schema.org/url> <https://twitter.com/FarrukoPR> .'
            ].join ("\n");

            var root = "test:titerito";

            return parser.compactFromTurtle (input, context, root).then (function (result) {
                assert.deepEqual (result['@context'], {
                    'foaf': 'http://xmlns.com/foaf/0.1/',
                    'test': 'https://example.com/ns#',
                    'schema': 'http://schema.org/',
                    'author': { '@id': 'foaf:maker' },
                    'lastName': { '@id': 'foaf:familyName' },
                    'schema:url': { '@type': '@id' },
                    'schema:sameAs': { '@type': '@id' }
                });

                assert.deepEqual (result['author'], {
                    '@id': 'test:farruko',
                    'lastName': 'Reyes Rosado',
                    'schema:url': 'https://twitter.com/FarrukoPR'
                });

                assert.deepEqual (result['schema:url'], {
                    '@id': 'http://youtu.be/X4lkfFpHw-8',
                    '@type': 'schema:CreativeWork',
                    'schema:sameAs':
                    'http://musicbrainz.org/recording/5016995f-0abc-4193-8a6d-0d16e6669396'
                });
            });

        });

    });

    suite ('JSON-LD to Turtle', function () {

        test ('no graph', function () {
            var input = JSON.stringify({
                "@context": { "dc": "http://purl.org/dc/terms/" },
                "@id": "https://example.com/titerito",
                "dc:title": {
                    "@language": "es",
                    "@value": "Titerito"
                }
            }, null, "    ");

            return parser.fromJsonld (input).then (function (result) {
                var expected = [
                    '@prefix dc: <http://purl.org/dc/terms/>.',
                    '',
                    '<https://example.com/titerito> dc:title "Titerito"@es.',
                    ''
                ].join ("\n");

                assert.equal (result, expected);
            });
        });
    });

});
