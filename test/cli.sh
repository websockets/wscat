#!/bin/bash

function sha256() {
    echo $(shasum -p -a 256 $1 | awk '{ print $1 }')
}

test_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
test_port=41328

dd bs=32768 count=42 if=/dev/urandom of=${test_dir}/testfile1
checksum1=$(sha256 ${test_dir}/testfile1)

wscat="${test_dir}/../node_modules/.bin/ts-node ${test_dir}/../src/cli.ts"

$wscat --version || exit 1

$wscat -b -l $test_port > ${test_dir}/testfile2 &
spid=$!
sleep 1
$wscat -b localhost:$test_port < ${test_dir}/testfile1 &
cpid=$!

wait $cpid || exit $?
wait $spid || exit $?

checksum2=$(sha256 ${test_dir}/testfile2)

if [ "${checksum1}" != "${checksum2}" ]; then
    echo "Checksums differ"
    exit 1
fi

echo "bar" | $wscat -l $test_port &
sleep 1
foo=$($wscat localhost:$test_port)

if [ "${foo}" != "bar" ]; then
    exit 1
fi

rm ${test_dir}/testfile*

echo "All ok"
