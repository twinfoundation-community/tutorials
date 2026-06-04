# tutorials.102

## What's included

* [Dataspace App](./dataspace-example-app/) and sharing data among Nodes exemplified through the [Consumer Client Extension](./consumer-client/).

* `twin-node.sh` script to bootstrap and administer a Node. Use `twin-node.sh --help` to see the list of available commands.

## Getting started

You can use:

```sh
twin-node.sh <bootstrap_command> 
```

to execute the bootstrap commands specified by [the step by step bootstrapping](../../common/HOWTO-bootstrap-node.md).

For example to create a tenant:

```sh
./twin-node.sh tenant-create
```

Alternatively you can perform a bootstrap-legacy as described in [Tutorial 101](../101/README.md):

```sh
twin-node.sh bootstrap-legacy
```

## Tutorial data

[Tutorial Data Link](./tutorial-data/data.md)
