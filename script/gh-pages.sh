#
# Deploy to the gh-pages
#


#
# Algorithm used while generating and pushing documentation
#
# - if this is a commit on the master branch. continue. Otherwise exit
# - if it is NOT a pull-request being drafted to master branch, continue.
#   Otherwise, exit
# - generate the documentation immediately
# - clone the repo into a directory `_out.`
# - cd into the cloned repo
# - checkout the gh-pages branch
# - if documentation with current version does not exist, contine. Otherwise
#   exit
# - copy over the documentation
# - git add and commit the changes, marking it with the version of
#   generated docs
# - add github access token to allow pushing to repo
# - git push to the gh-pages and exit
#


# we must stop on error
set -e


# variables
GH_URL="https://github.com/Ma3Route/node-ss-interface"


# ensure we are on master branch
[ "${TRAVIS_BRANCH}" != "master" ] && {
    echo " >> we are not on master branch (${TRAVIS_BRANCH})"
    echo " >> exiting now!"
    exit
}


# ignore pull requests
[ "${TRAVIS_PULL_REQUEST}" == false ] || {
    echo " >> this is another awesome pull-request"
    echo " >> no need to build docs"
    exit
}


echo " >> building docs"
grunt docs


echo " >> cloning repo"
git clone "${GH_URL}" _out


echo " >> getting into repo and switching branches"
cd _out
git checkout gh-pages


# ensure there is a version bump
VERSION="$(node -e "console.log(require('../package.json').version)")"
[ -d ${VERSION} ] && {
    echo " >> version bump required"
    echo " >> stopping to avoid clobbering existing docs"
    exit
}


echo "copying jsdoc output"
mv ../docs/ss-interface/${VERSION} .


log "installing dependencies for compiling" 0
npm install


log "compiling the landing page" 0
npm run compile


log "configuring and comitting changes" 0
git config user.email "mugo@forfuture.co.ke"
git config user.name "GochoMugo"
git add -A .
git commit -a -m "v${VERSION} docs"


log "adding github authentication token" 0
echo -e "machine github.com\n  login mugo@forfuture.co.ke\n  password ${GH_TOKEN}" >> ~/.netrc


log "pushing to gh-pages branch" 0
git push origin gh-pages \
  && log "successfully pushed to gh-pages" 1 \
  || log "failed to push to gh-pages" 2
