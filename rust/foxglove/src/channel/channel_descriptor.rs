use std::{collections::BTreeMap, sync::Arc};

use crate::channel::ChannelId;

/// Information about a Channel.
pub struct ChannelDescriptor(Arc<Inner>);

struct Inner {
    id: ChannelId,
    topic: String,
    message_encoding: String,
    metadata: BTreeMap<String, String>,
}

impl ChannelDescriptor {
    pub(crate) fn new(
        id: ChannelId,
        topic: String,
        message_encoding: String,
        metadata: BTreeMap<String, String>,
    ) -> Arc<Self> {
        Arc::new(Self(Arc::new(Inner {
            id,
            topic,
            message_encoding,
            metadata,
        })))
    }

    /// Returns the channel ID.
    pub fn id(&self) -> ChannelId {
        self.0.id
    }

    /// Returns the channel topic.
    pub fn topic(&self) -> &str {
        &self.0.topic
    }

    /// Returns the message encoding for this channel.
    pub fn message_encoding(&self) -> &str {
        &self.0.message_encoding
    }

    /// Returns the metadata for this channel.
    pub fn metadata(&self) -> &BTreeMap<String, String> {
        &self.0.metadata
    }

    pub(crate) fn matches(&self, other: &Self) -> bool {
        self.0.topic == other.0.topic
            && self.0.message_encoding == other.0.message_encoding
            && self.0.metadata == other.0.metadata
    }
}
