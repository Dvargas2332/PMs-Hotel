#!/bin/bash
cd /var/app/current || exit 1
export PATH=/usr/local/bin:/usr/bin:/bin
echo "Running prisma migrate deploy..."
npx prisma migrate deploy || exit 1
