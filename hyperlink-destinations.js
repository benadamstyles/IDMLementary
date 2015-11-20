import _ from 'underscore-contrib'
import {DOMParser, XMLSerializer} from 'xmldom'
import mkd from 'mkdirp'
import fs_node from 'fs'
import path from 'path'
import glob from 'glob'
import copy_node from 'copy'
import Promise from 'bluebird'

const fs = Promise.promisifyAll(fs_node)
const copy = Promise.promisify(copy_node)

_.times(100, _.uniqueId)

const args = _.rest(process.argv, 2),
      titleStyles = _.rest(args),
      parser = new DOMParser(),
      stringifier = new XMLSerializer(),
      idmlFilePath = args[0],
      idmlFileName = path.basename(idmlFilePath),
      idmlDirPath = path.dirname(idmlFilePath);

/**
 * Check if a string contains one of a list of matcher strings
 * @param  {String}   str      The string to check
 * @param  {String[]} matchers Array of matcher strings
 * @return {Boolean}           True if matches at least 1
 */
function containsOne(str, matchers) {
  return matchers.some(matcher => str.includes(matcher))
}

function insertAfter(referenceNode, newNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling)
}

function read(entry) {
  return new Promise(resolve => {
    let content = ''

    entry.setEncoding('utf8')

    entry
    .on('data', data => {content += data})
    .on('end', () => resolve(content))
  })
}

glob(path.join(idmlFilePath, '**/*'), (err, filenames) => {
  if (err) console.error(err)
  else {
    filenames.forEach(filename => {
      const filepath = filename.replace(idmlFilePath, ''),
            destName = path.basename(filepath),
            destFolder = path.join(idmlDirPath, idmlFileName + '+', path.dirname(filepath));

      // if (path.basename(filepath) === 'designmap.xml') {
      //   const designmap = parser.parseFromString(fs.readFileSync(designmapFilePath, 'utf8'), 'text/xml');
      // }

      if (path.dirname(filepath).toLowerCase().includes('stories')) {
        fs.readFileAsync(filename, 'utf8')
        .then(content => {
          const doc = parser.parseFromString(content, 'text/xml'),
                paras = Array.from(doc.getElementsByTagName('ParagraphStyleRange')),
                titles = paras.filter(para =>
                  containsOne(para.getAttribute('AppliedParagraphStyle'), titleStyles)
                ),
                usedLinkNames = new Set(),
                hyperlinks = new Set();

          function crode(name, attrs, text) {
            const el = doc.createElement(name)
            _.each(attrs, (v, k) => el.setAttribute(k, v))
            if (text) el.textContent = text
            return el
          }

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

          mkd(destFolder, err => {
            if (!err) {
              let w = fs.createWriteStream(path.join(destFolder, destName))
              w.on('open', () => {
                w.write(stringifier.serializeToString(doc))
                console.log('Processed ' + filepath)
              })
              .on('error', console.error.bind(console))
            } else console.error(err)
          })
        })
      }

      else if (fs.lstatSync(filename).isFile()) {
        mkd(destFolder, err => {
          if (!err) copy(filename, destFolder).catch(err => console.error('COPY', err))
          else console.error('MKD 2', err)
        })
      }

    })
  }
})
