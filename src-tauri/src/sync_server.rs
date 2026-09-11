use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};

use futures_util::{SinkExt, StreamExt};
use local_ip_address::list_afinet_netifas;
use serde::Serialize;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, watch, Mutex};
use tokio_tungstenite::accept_async;
use tokio_tungstenite::tungstenite::Message;

pub const DEFAULT_PORT: u16 = 7840;
static CLIENT_SEQ: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Serialize)]
pub struct ServerInfo {
    pub ip: String,
    pub port: u16,
    pub url: String,
    pub addresses: Vec<String>,
}

pub struct SyncServer {
    shutdown: Mutex<Option<watch::Sender<bool>>>,
    info: Mutex<Option<ServerInfo>>,
}

impl Default for SyncServer {
    fn default() -> Self {
        Self {
            shutdown: Mutex::new(None),
            info: Mutex::new(None),
        }
    }
}

impl SyncServer {
    pub async fn start(&self, port: u16) -> Result<ServerInfo, String> {
        if let Some(info) = self.info.lock().await.clone() {
            return Ok(info);
        }

        let listener = TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port)))
            .await
            .map_err(|error| format!("WebSocketサーバーを起動できません: {error}"))?;
        let bound_port = listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port();

        let addresses = local_ipv4_addresses();
        let ip = addresses
            .first()
            .cloned()
            .unwrap_or_else(|| "127.0.0.1".to_string());
        let info = ServerInfo {
            ip: ip.clone(),
            port: bound_port,
            url: connection_url(&ip, bound_port),
            addresses,
        };

        let (broadcast_tx, _) = broadcast::channel::<(u64, Message)>(256);
        let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

        tauri::async_runtime::spawn(async move {
            loop {
                tokio::select! {
                    _ = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            break;
                        }
                    }
                    accepted = listener.accept() => {
                        match accepted {
                            Ok((stream, _)) => {
                                let tx = broadcast_tx.clone();
                                tauri::async_runtime::spawn(handle_connection(stream, tx));
                            }
                            Err(_) => break,
                        }
                    }
                }
            }
        });

        *self.shutdown.lock().await = Some(shutdown_tx);
        *self.info.lock().await = Some(info.clone());
        Ok(info)
    }

    pub async fn stop(&self) {
        if let Some(tx) = self.shutdown.lock().await.take() {
            let _ = tx.send(true);
        }
        *self.info.lock().await = None;
    }
}

async fn handle_connection(stream: TcpStream, tx: broadcast::Sender<(u64, Message)>) {
    let id = CLIENT_SEQ.fetch_add(1, Ordering::Relaxed);
    let Ok(ws) = accept_async(stream).await else {
        return;
    };
    let (mut write, mut read) = ws.split();
    let mut rx = tx.subscribe();

    let send_loop = async {
        while let Ok((sender_id, message)) = rx.recv().await {
            if sender_id != id && write.send(message).await.is_err() {
                break;
            }
        }
    };

    let recv_loop = async {
        while let Some(Ok(message)) = read.next().await {
            if message.is_close() {
                break;
            }
            let _ = tx.send((id, message));
        }
    };

    tokio::select! {
        _ = send_loop => {}
        _ = recv_loop => {}
    }
}

fn local_ipv4_addresses() -> Vec<String> {
    let Ok(ifaces) = list_afinet_netifas() else {
        return Vec::new();
    };

    let mut addresses: Vec<String> = ifaces
        .into_iter()
        .filter_map(|(_, ip)| {
            if ip.is_ipv4() && !ip.is_loopback() {
                Some(ip.to_string())
            } else {
                None
            }
        })
        .collect();
    addresses.sort();
    addresses.dedup();
    addresses
}

pub fn connection_url(ip: &str, port: u16) -> String {
    format!("ws://{ip}:{port}")
}

#[cfg(test)]
mod tests {
    use super::connection_url;

    #[test]
    fn builds_ws_url() {
        assert_eq!(connection_url("192.168.1.8", 7840), "ws://192.168.1.8:7840");
    }
}
