import { useState, useEffect } from 'react';
import { Node } from '@xyflow/react';
import './WorkflowProperties.css';

interface WorkflowPropertiesProps {
  node: Node;
  onUpdate: (id: string, newData: any) => void;
}

const WorkflowProperties = ({ node, onUpdate }: WorkflowPropertiesProps) => {
  const [label, setLabel] = useState<string>(String(node.data.label || ''));
  const [description, setDescription] = useState<string>(String(node.data.description || ''));
  const [configJson, setConfigJson] = useState<string>(
    JSON.stringify(node.data.config || {}, null, 2)
  );

  useEffect(() => {
    setLabel(String(node.data.label || ''));
    setDescription(String(node.data.description || ''));
    setConfigJson(JSON.stringify(node.data.config || {}, null, 2));
  }, [node]);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLabel(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfigJson(e.target.value);
  };

  const handleApply = () => {
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(configJson);
    } catch {
      alert('Invalid JSON configuration');
      return;
    }

    onUpdate(node.id, {
      label,
      description,
      config: parsedConfig,
    });
  };

  return (
    <div className="properties-panel">
      <div className="properties-header">
        <h3>Properties</h3>
        <span className="node-type">{node.type}</span>
      </div>
      
      <div className="property-group">
        <label htmlFor="node-name">Node Name</label>
        <input
          id="node-name"
          type="text"
          value={label}
          onChange={handleLabelChange}
          placeholder="Enter node name"
        />
      </div>

      <div className="property-group">
        <label htmlFor="node-description">Description</label>
        <textarea
          id="node-description"
          value={description}
          onChange={handleDescriptionChange}
          placeholder="Enter node description"
          rows={3}
        />
      </div>

      <div className="property-group">
        <label htmlFor="node-config">Configuration (JSON)</label>
        <textarea
          id="node-config"
          value={configJson}
          onChange={handleConfigChange}
          placeholder='{ "key": "value" }'
          rows={8}
        />
      </div>

      <button className="apply-btn" onClick={handleApply}>
        Apply Changes
      </button>

      <div className="node-info">
        <small>Node ID: {node.id}</small>
      </div>
    </div>
  );
};

export default WorkflowProperties;
