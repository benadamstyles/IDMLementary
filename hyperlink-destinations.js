import _ from 'underscore-contrib'
import {DOMParser, XMLSerializer} from 'xmldom'
import fs from 'fs'
import path from 'path'

_.times(100, _.uniqueId)

const args = _.rest(process.argv, 2),
      titleStyle = args[1],
      parser = new DOMParser(),
      stringifier = new XMLSerializer(),
      xmlFilePath = args[0],
      designmapFilePath = path.resolve(xmlFilePath, '../../designmap.xml'),
      doc = parser.parseFromString(fs.readFileSync(xmlFilePath, 'utf8'), 'text/xml'),
      designmap = parser.parseFromString(fs.readFileSync(designmapFilePath, 'utf8'), 'text/xml');

function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)
}

function crode(name, attrs, text) {
  const el = doc.createElement(name)
  _.each(attrs, (v, k) => el.setAttribute(k, v))
  if (text) el.textContent = text
  return el
}

const paras = Array.from(doc.getElementsByTagName('ParagraphStyleRange')),
      titles = paras.filter(para => para.getAttribute('AppliedParagraphStyle') === `ParagraphStyle/${titleStyle}`),
      usedLinkNames = new Set(),
      hyperlinks = new Set();

function ensureUnique(string) {
  if (usedLinkNames.has(string)) {
    return _.uniqueId(string + ' ')
  } else {
    usedLinkNames.add(string)
    return string
  }
}

titles.forEach(title => {
  const Content = title.getElementsByTagName('Content')[0]

  if (Content) {
    const Name = ensureUnique(Content.textContent),
          Dest = crode('HyperlinkTextDestination', {
            Name,
            Self: `HyperlinkTextDestination/${Name}`,
            Hidden: 'false',
            DestinationUniqueKey: _.uniqueId()
          });

    Content.parentNode.insertBefore(Dest, Content)
  }
})

const dmDocEl = designmap.getElementsByTagName('Document')[0]

// TODO add hyperlinks?

fs.writeFile(xmlFilePath, stringifier.serializeToString(doc), 'utf8')
